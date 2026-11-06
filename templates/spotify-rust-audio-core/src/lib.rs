//! Spotify-Grade High-Performance Lockless Audio Core Engine
//! Governed by ADR-028 and OpenSpec SPEC-012

use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

pub const TARGET_LUFS: f32 = -14.0;
pub const BUFFER_CAPACITY: usize = 65536; // 64K sample frames (~1.48 seconds @ 44.1kHz)

/// Lockless Single-Producer Single-Consumer (SPSC) Audio Ring Buffer
pub struct LocklessAudioRingBuffer {
    buffer: Vec<f32>,
    capacity: usize,
    head: AtomicUsize,
    tail: AtomicUsize,
}

impl LocklessAudioRingBuffer {
    pub fn new(capacity: usize) -> Self {
        let actual_cap = capacity.next_power_of_two();
        Self {
            buffer: vec![0.0; actual_cap],
            capacity: actual_cap,
            head: AtomicUsize::new(0),
            tail: AtomicUsize::new(0),
        }
    }

    #[inline(always)]
    pub fn push(&mut self, sample: f32) -> bool {
        let head = self.head.load(Ordering::Relaxed);
        let tail = self.tail.load(Ordering::Acquire);
        if head.wrapping_sub(tail) >= self.capacity {
            return false; // Buffer full
        }
        let index = head & (self.capacity - 1);
        self.buffer[index] = sample;
        self.head.store(head.wrapping_add(1), Ordering::Release);
        true
    }

    #[inline(always)]
    pub fn pop(&mut self) -> Option<f32> {
        let tail = self.tail.load(Ordering::Relaxed);
        let head = self.head.load(Ordering::Acquire);
        if tail == head {
            return None; // Buffer empty
        }
        let index = tail & (self.capacity - 1);
        let sample = self.buffer[index];
        self.tail.store(tail.wrapping_add(1), Ordering::Release);
        Some(sample)
    }

    pub fn available_read(&self) -> usize {
        let head = self.head.load(Ordering::Acquire);
        let tail = self.tail.load(Ordering::Relaxed);
        head.wrapping_sub(tail)
    }
}

/// Computes the required linear gain factor to match Spotify standard target -14 LUFS
#[inline]
pub fn calculate_spotify_loudness_gain(measured_lufs: f32, target_lufs: f32) -> f32 {
    let delta_db = target_lufs - measured_lufs;
    10.0f32.powf(delta_db / 20.0)
}

/// Applies ITU-R BS.1770 linear gain normalization with peak ceiling limiting
pub fn normalize_audio_frame(samples: &mut [f32], gain: f32, peak_ceiling: f32) {
    for s in samples.iter_mut() {
        let amplified = *s * gain;
        *s = amplified.clamp(-peak_ceiling, peak_ceiling);
    }
}

/// Gapless sinusoidal equal-power crossfade between outgoing track A and incoming track B
pub fn equal_power_crossfade(sample_a: f32, sample_b: f32, t: f32) -> f32 {
    let t_clamped = t.clamp(0.0, 1.0);
    let angle = t_clamped * (std::f32::consts::PI / 2.0);
    let gain_a = angle.cos();
    let gain_b = angle.sin();
    (sample_a * gain_a) + (sample_b * gain_b)
}

/// Camelot Harmonic Mixing compatibility check (same key, +/-1 hour, or relative major/minor)
pub fn is_camelot_compatible(key_a: &str, key_b: &str) -> bool {
    if key_a == key_b {
        return true;
    }
    // Parse numbers (1-12) and modes (A/B)
    let parse = |k: &str| -> Option<(u8, char)> {
        let len = k.len();
        if len < 2 {
            return None;
        }
        let (num_str, mode_char) = k.split_at(len - 1);
        let num: u8 = num_str.parse().ok()?;
        let mode: char = mode_char.chars().next()?;
        if (1..=12).contains(&num) && (mode == 'A' || mode == 'B') {
            Some((num, mode))
        } else {
            None
        }
    };

    match (parse(key_a), parse(key_b)) {
        (Some((nA, mA)), Some((nB, mB))) => {
            if mA == mB {
                let diff = (nA as i8 - nB as i8).abs();
                diff == 1 || diff == 11 // Adjacent on 12-hour clock
            } else if nA == nB {
                true // Relative major/minor switch
            } else {
                false
            }
        }
        _ => false,
    }
}
