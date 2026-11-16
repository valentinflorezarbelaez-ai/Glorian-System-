// Canonical Freestanding Zig Linear-Memory Kernels for WebAssembly (wasm32-freestanding)
// Zero-allocation, deterministic hashing and lock-free LMAX ring-buffer backpressure arithmetic.

/// Canonical 32-bit FNV-1a digest over linear memory byte slice.
export fn zig_fnv1a32_hash(ptr: [*]const u8, len: usize) u32 {
    var hash: u32 = 0x811c9dc5;
    var i: usize = 0;
    while (i < len) : (i += 1) {
        hash ^= @as(u32, ptr[i]);
        hash *%= 0x01000193;
    }
    return hash;
}

/// Bounded lock-free ring-buffer free slot calculator.
/// Returns non-negative free slots clamped within [0, capacity].
export fn zig_ring_buffer_free_slots(producer_seq: i32, consumer_seq: i32, capacity: i32) i32 {
    if (capacity <= 0) {
        return 0;
    }
    const in_flight = producer_seq - consumer_seq;
    if (in_flight <= 0) {
        return capacity;
    }
    if (in_flight >= capacity) {
        return 0;
    }
    return capacity - in_flight;
}
