// Little-endian binary writer/reader that matches .NET BinaryWriter/BinaryReader semantics
// (strings are UTF-8 with a 7-bit-encoded length prefix), which is what Cities: Skylines'
// Colossal Raw Asset Package (CRAP) serializer uses.

export class ByteWriter {
  constructor(cap = 1 << 16) {
    this.buf = new Uint8Array(cap);
    this.view = new DataView(this.buf.buffer);
    this.pos = 0;
  }
  _ensure(n) {
    if (this.pos + n <= this.buf.length) return;
    let cap = this.buf.length;
    while (cap < this.pos + n) cap *= 2;
    const nb = new Uint8Array(cap);
    nb.set(this.buf);
    this.buf = nb;
    this.view = new DataView(nb.buffer);
  }
  u8(v) { this._ensure(1); this.view.setUint8(this.pos, v); this.pos += 1; return this; }
  bool(v) { return this.u8(v ? 1 : 0); }
  u16(v) { this._ensure(2); this.view.setUint16(this.pos, v, true); this.pos += 2; return this; }
  i32(v) { this._ensure(4); this.view.setInt32(this.pos, v, true); this.pos += 4; return this; }
  u32(v) { this._ensure(4); this.view.setUint32(this.pos, v >>> 0, true); this.pos += 4; return this; }
  i64(v) { this._ensure(8); this.view.setBigInt64(this.pos, BigInt(v), true); this.pos += 8; return this; }
  f32(v) { this._ensure(4); this.view.setFloat32(this.pos, v, true); this.pos += 4; return this; }
  bytes(arr) { this._ensure(arr.length); this.buf.set(arr, this.pos); this.pos += arr.length; return this; }
  ascii(s) { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i) & 0xff); return this; }
  // .NET BinaryWriter.Write(string)
  str(s) {
    const enc = new TextEncoder().encode(s ?? '');
    let n = enc.length;
    do {
      let b = n & 0x7f;
      n >>>= 7;
      if (n) b |= 0x80;
      this.u8(b);
    } while (n);
    return this.bytes(enc);
  }
  v2(x, y) { return this.f32(x).f32(y); }
  v3(x, y, z) { return this.f32(x).f32(y).f32(z); }
  v4(x, y, z, w) { return this.f32(x).f32(y).f32(z).f32(w); }
  result() { return this.buf.slice(0, this.pos); }
}

export class ByteReader {
  constructor(u8) {
    this.buf = u8;
    this.view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    this.pos = 0;
  }
  u8() { return this.view.getUint8(this.pos++); }
  bool() { return this.u8() !== 0; }
  u16() { const v = this.view.getUint16(this.pos, true); this.pos += 2; return v; }
  i32() { const v = this.view.getInt32(this.pos, true); this.pos += 4; return v; }
  u32() { const v = this.view.getUint32(this.pos, true); this.pos += 4; return v; }
  i64() { const v = Number(this.view.getBigInt64(this.pos, true)); this.pos += 8; return v; }
  f32() { const v = this.view.getFloat32(this.pos, true); this.pos += 4; return v; }
  bytes(n) { const v = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return v; }
  ascii(n) { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(this.u8()); return s; }
  str() {
    let n = 0, shift = 0, b;
    do {
      b = this.u8();
      n |= (b & 0x7f) << shift;
      shift += 7;
    } while (b & 0x80);
    return new TextDecoder().decode(this.bytes(n));
  }
  v2() { return [this.f32(), this.f32()]; }
  v3() { return [this.f32(), this.f32(), this.f32()]; }
  v4() { return [this.f32(), this.f32(), this.f32(), this.f32()]; }
  array(fn) { const n = this.i32(); if (n < 0 || n > 1e8) throw new Error('bad array length ' + n); const out = new Array(n); for (let i = 0; i < n; i++) out[i] = fn(this); return out; }
}
