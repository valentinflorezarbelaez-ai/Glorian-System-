// Glorian System — Freestanding Zig WebAssembly SIMD 128-bit Kernel (SPEC-310 / CHANGE-172)
// Target: wasm32-freestanding (-mcpu=generic+simd128 -O ReleaseSmall -fstrip -fno-entry -rdynamic)

const Vec4i32 = @Vector(4, i32);

export fn zig_simd_i32x4_max_join(ptr_a: [*]const i32, ptr_b: [*]const i32, ptr_out: [*]i32) i32 {
    const va: Vec4i32 = ptr_a[0..4].*;
    const vb: Vec4i32 = ptr_b[0..4].*;
    const vmax: Vec4i32 = @max(va, vb);
    ptr_out[0..4].* = vmax;
    return vmax[0] +% vmax[1] +% vmax[2] +% vmax[3];
}

export fn zig_simd_i32x4_dot(ptr_a: [*]const i32, ptr_b: [*]const i32) i32 {
    const va: Vec4i32 = ptr_a[0..4].*;
    const vb: Vec4i32 = ptr_b[0..4].*;
    const vprod: Vec4i32 = va *% vb;
    return vprod[0] +% vprod[1] +% vprod[2] +% vprod[3];
}

export fn zig_simd_v128_xor_tag(ptr_a: [*]const i32, ptr_b: [*]const i32) i32 {
    const va: Vec4i32 = ptr_a[0..4].*;
    const vb: Vec4i32 = ptr_b[0..4].*;
    const vxor: Vec4i32 = va ^ vb;
    return vxor[0] ^ vxor[1] ^ vxor[2] ^ vxor[3];
}
