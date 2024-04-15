/** Jenkins's `one_at_a_time` non-cryptographic hash function. */
export function hashString(str: string): number {
  let hash = 0;
  for (const char of str) {
    hash = (hash + (char.codePointAt(0) ?? 0)) >>> 0;
    hash = (hash + (hash << 10)) >>> 0;
    hash = hash ^ ((hash >> 6) >>> 0);
  }
  hash = (hash + (hash << 3)) >>> 0;
  hash = (hash ^ (hash >> 1)) >>> 0;
  hash = (hash + (hash << 15)) >>> 0;
  return hash;
}

export function hashPair(x: number, y: number): number {
  return (Math.imul(1073741827, x) + y) >>> 0;
}

const f = new Float64Array(1);
const u = new Uint32Array(f.buffer);
export function hashAny(a: string | number) {
  if (typeof a === "string") return hashString(a);
  f[0] = a;
  return hashPair(u[1], u[0]);
}
