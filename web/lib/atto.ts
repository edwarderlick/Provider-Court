// Shared GEN <-> atto conversion, safe for both server and browser code
// (no "server-only" import, no env access).
const ATTO = 1_000_000_000_000_000_000n;

export function attoToGen(value: string | number | bigint): number {
  return Number(BigInt(value)) / Number(ATTO);
}

export function genToAtto(gen: number): bigint {
  // Round to 6 decimal places before scaling to avoid float noise producing
  // a non-integer atto amount, which the contract would reject outright.
  const microGen = Math.round(gen * 1_000_000);
  return (BigInt(microGen) * ATTO) / 1_000_000n;
}
