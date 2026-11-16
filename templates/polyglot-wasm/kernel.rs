#![no_std]

use core::panic::PanicInfo;

#[panic_handler]
fn panic(_info: &PanicInfo) -> ! {
    loop {}
}

/// Hardware-isolated CRDT state-vector element-wise join in linear memory.
/// Computes max(ptr_a[i], ptr_b[i]) into ptr_out[i] and returns the saturated sum.
#[no_mangle]
pub unsafe extern "C" fn rust_crdt_vector_join(
    ptr_a: *const i32,
    ptr_b: *const i32,
    ptr_out: *mut i32,
    len: usize,
) -> i32 {
    if ptr_a.is_null() || ptr_b.is_null() || ptr_out.is_null() {
        return -1;
    }

    let mut total: i32 = 0;
    let mut i: usize = 0;
    while i < len {
        let a = *ptr_a.add(i);
        let b = *ptr_b.add(i);
        let joined = if a >= b { a } else { b };
        *ptr_out.add(i) = joined;
        total = total.wrapping_add(joined);
        i += 1;
    }
    total
}

/// Canonical 32-bit FNV-1a hash over contiguous linear memory bytes.
#[no_mangle]
pub unsafe extern "C" fn rust_fnv1a32(ptr: *const u8, len: usize) -> u32 {
    if ptr.is_null() {
        return 0;
    }

    let mut hash: u32 = 0x811c9dc5;
    let mut i: usize = 0;
    while i < len {
        let byte = *ptr.add(i) as u32;
        hash ^= byte;
        hash = hash.wrapping_mul(0x01000193);
        i += 1;
    }
    hash
}
