export type JobModality = "TEXT" | "IMAGE" | "AUDIO";

// Per the master spec's state machine:
// Listed -> Funded -> Accepted -> Delivered -> Adjudicating ->
//   Released | PartiallyReleased | Refunded -> Disputed -> Cancelled | Expired | Missed
export type JobState =
  | "Listed"
  | "Funded"
  | "Accepted"
  | "Delivered"
  | "Adjudicating"
  | "Released"
  | "PartiallyReleased"
  | "Refunded"
  | "Disputed"
  | "Cancelled"
  | "Expired"
  | "Missed";

export interface ClauseVerdict {
  id: string;
  label: string;
  evidence: string;
  verdict: "PASS" | "FAILED_SPEC" | "MINOR_FAIL";
}

export interface Job {
  id: string;
  title: string;
  modality: JobModality;
  prompt: string;
  clauses: number;
  rewardGen: number;
  ttl: string;
  state: JobState;
  urgent?: boolean;
  imageUrl?: string;
  providerId?: string;
  providerName?: string;
  buyerId?: string;
  releaseFraction?: number;
  clauseVerdicts?: ClauseVerdict[];
  deadline?: string;
  cid?: string;
  gatewayUrl?: string;
  disputeBondGen?: number;
  // True once claim_settlement has actually paid out the reward -- distinct
  // from `state` being Released/PartiallyReleased/Refunded, which only means
  // a verdict exists, not that funds have moved yet (see claim_settlement's
  // own doc comment in the contract). Used to gate Appeal once real money has
  // already moved, not just once a verdict has been recorded.
  settled?: boolean;
}

export interface ListingClause {
  type: string;
  value: string;
  weight: number;
}

export interface Listing {
  id: string;
  provider: string;
  providerName?: string;
  modality: JobModality;
  description: string;
  clauses: ListingClause[];
  priceGen: number;
  deliverWindowSeconds: number;
  appealWindowSeconds: number;
  disputeBondGen: number;
  active: boolean;
  createdAt: string;
  requiresInput: boolean;
  inputHint?: string;
}

// An order is exactly a Job (same escrow/adjudication/appeal record) plus
// which listing spawned it -- see contract's get_order(). listingId is -1
// for legacy jobs created via the old create_job() path rather than
// purchase().
export interface Order extends Job {
  listingId: number;
}

export interface Provider {
  id: string;
  name: string;
  trustScore: number;
  jobsCompleted: number;
  fullReleaseRate: number;
  avgReleaseFraction: number;
  activeJobs: number;
  maxCapacity: number;
  modalities: { icon: string; label: string; detail: string }[];
  uptime: string;
  latency: string;
  region: string;
}

export interface ActivityEntry {
  id: string;
  timestamp: string;
  jobId: string;
  modality: string;
  outcome: "PARTIAL_RELEASE" | "FULL_ESCROW_RELEASE" | "NULL_SETTLEMENT";
  releaseFraction: number;
}

export type WalletStatus = "disconnected" | "connecting" | "connected";

export interface WalletState {
  status: WalletStatus;
  address: string | null;
  wrongNetwork: boolean;
}
