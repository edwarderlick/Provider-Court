// Testnet faucets hand out ~100 GEN per wallet per week, so every mock GEN
// figure in the app needs to fit comfortably inside that budget across a
// full demo session (several funded jobs + at least one appeal bond).
export const TESTNET_FAUCET_GEN = 100;

export function formatGen(amount: number): string {
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Appeal bonds scale with the job's own price instead of a flat figure, so a
// bond on a 0.5 GEN job doesn't cost the same as a bond on a 2 GEN job.
export function appealBondFor(rewardGen: number): number {
  return round2(rewardGen * 1.5);
}

export function networkFeeFor(bondGen: number): number {
  return round2(Math.max(0.01, bondGen * 0.01));
}
