function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
export function keyedUnit(seed: number, ...keys: Array<string | number>): number {
  let x = hash([seed, ...keys].join("|"));
  x += 0x6d2b79f5; x = Math.imul(x ^ (x >>> 15), x | 1); x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
}
export function keyedInt(seed: number, min: number, max: number, ...keys: Array<string | number>): number { return min + Math.floor(keyedUnit(seed, ...keys) * (max - min + 1)); }
export function stableId(prefix: string, seed: number, ...keys: Array<string | number>): string { return `${prefix}-${hash([seed, ...keys].join("|")).toString(16).padStart(8, "0")}`; }
