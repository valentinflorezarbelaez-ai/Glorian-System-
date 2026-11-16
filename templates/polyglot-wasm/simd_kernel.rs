//! Glorian System — `#![no_std]` Rust WebAssembly SIMD 128-bit Kernel (SPEC-310 / CHANGE-172)
#![no_std]

#[panic_handler]
fn panic(_info: &core::panic::PanicInfo) -> ! {
    loop {}
}

#[no_mangle]
pub unsafe extern "C" fn rust_simd_i32x4_max_join(
    ptr_a: *const i32,
    ptr_b: *const i32,
    ptr_out: *mut i32,
) -> i32 {
    let mut sum: i32 = 0;
    let mut i: usize = 0;
    while i < 4 {
        let a = *ptr_a.add(i);
        let b = *ptr_b.add(i);
        let m = if a >= b { a } else { b };
        *ptr_out.add(i) = m;
        sum = sum.wrapping_add(m);
        i += 1;
    }
    sum
}

#[no_mangle]
pub unsafe extern "C" fn rust_simd_i32x4_dot(ptr_a: *const i32, ptr_b: *const i32) -> i32 {
    let mut acc: i32 = 0;
    let mut i: usize = 0;
    while i < 4 {
        acc = acc.wrapping_add((*ptr_a.add(i)).wrapping_mul(*ptr_b.add(i)));
        i += 1;
    }
    acc
}
