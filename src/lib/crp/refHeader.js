// Reads the header of a REAL .crp (made by the game or the Asset Editor) and returns the author field.
// The game stores that field AES-encrypted (base64) and decrypts it with a key built into the game;
// we do not have the key, so exports reuse the value from a genuine package.
export function readReferenceHeader(buf) {
  const u8 = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let p = 0;
  const need = (n) => { if (p + n > u8.length) throw new Error('File is too short to be a .crp'); };
  const str = () => {
    let len = 0, shift = 0, b;
    do { need(1); b = u8[p++]; len |= (b & 0x7f) << shift; shift += 7; if (shift > 35) throw new Error('Bad string length'); } while (b & 0x80);
    need(len);
    const s = new TextDecoder().decode(u8.subarray(p, p + len)); p += len; return s;
  };
  need(6);
  const magic = String.fromCharCode(u8[0], u8[1], u8[2], u8[3]);
  if (magic !== 'CRAP') throw new Error('Not a Cities: Skylines package (missing CRAP signature)');
  const version = u8[4] | (u8[5] << 8); p = 6;
  const packageName = str();
  const author = str();
  if (!author) throw new Error('This .crp has an empty author field. Pick a package downloaded from the Workshop or saved by the Asset Editor.');
  return { version, packageName, author };
}
