import { ActivityEntry, Job, Provider } from "./types";

export const MOCK_PROVIDER: Provider = {
  id: "ep-sampler-01",
  name: "EP-SAMPLER_01",
  trustScore: 99.8,
  jobsCompleted: 42,
  fullReleaseRate: 92,
  avgReleaseFraction: 0.88,
  activeJobs: 2,
  maxCapacity: 5,
  modalities: [
    { icon: "graphic_eq", label: "AUDIO_ENGINEERING", detail: "MASTERING / STEMS / SYNTH" },
    { icon: "terminal", label: "TEXT_MANIPULATION", detail: "FORMATTING / REGEX / PARSING" },
  ],
  uptime: "99.98%",
  latency: "24ms",
  region: "EU-WEST-01",
};

export const MOCK_JOBS: Job[] = [
  {
    id: "PC-982",
    title: "DAO Treasury Technical Audit",
    modality: "TEXT",
    prompt:
      "Generate a 2,000-word comprehensive technical audit for a decentralized autonomous organization (DAO) treasury management protocol...",
    clauses: 4,
    rewardGen: 0.6,
    ttl: "14m",
    state: "Listed",
  },
  {
    id: "PC-441",
    title: "Data Center Architectural Visualization",
    modality: "IMAGE",
    prompt:
      "Refine architectural visualization for a modular server facility. Require high-fidelity raytraced outputs with material accuracy...",
    clauses: 12,
    rewardGen: 1.5,
    ttl: "3h",
    state: "Listed",
    imageUrl:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuA1n4YFbnaDvhgvTd_zqybRo6xRd9efXOE1_V-EM_U71_WLm9q7-Q_Ok79cUix1TYCzxs_juCA04cfzf0JSVpt_Bb__XUZTyWC_DiO5yoRI5fO4lO3ECrpbhGZobLX9Wq7wp8ANDZGTkw91S8VPQR2jhpKcEZdypuuKVjQPiTEVWJRgBXOKxAAvzQy5xoCqCFp40B_1rPSYEACh6K0Hn9zJroTRjpuHhDLpfKrBirv3vmUwzXsVdEKMlGun9PSLZ4byNvdS2sqWdqvB",
  },
  {
    id: "PC-112",
    title: "Riddim Sample Pad Synthesis",
    modality: "AUDIO",
    prompt:
      "Synthesize rhythmic dub patterns and sequence 12 sample pads for a professional riddim system. 44.1kHz / 24-bit PCM required...",
    clauses: 8,
    rewardGen: 0.9,
    ttl: "1h 12m",
    state: "Listed",
  },
  {
    id: "PC-772",
    title: "Smart Contract Arbitration Clause Review",
    modality: "TEXT",
    prompt:
      "Legal review of smart contract arbitration clauses. Ensure compliance with maritime escrow standards and multi-sig resolution...",
    clauses: 2,
    rewardGen: 0.5,
    ttl: "45m",
    state: "Listed",
  },
  {
    id: "PC-003",
    title: "Generative Network Traffic Art Series",
    modality: "IMAGE",
    prompt:
      "Generative art series based on network traffic patterns. Visualization must incorporate real-time throughput data streams...",
    clauses: 24,
    rewardGen: 2,
    ttl: "24h",
    state: "Listed",
  },
  {
    id: "PC-991",
    title: "Emergency Node Mitigation",
    modality: "TEXT",
    prompt:
      "Emergency node mitigation assistance required. Must have experience with Layer 2 settlement latency issues during peak congestion...",
    clauses: 3,
    rewardGen: 1.2,
    ttl: "8m",
    state: "Listed",
    urgent: true,
  },
  {
    id: "AX-772",
    title: "Spectral Isolation Audio Processing",
    modality: "AUDIO",
    prompt:
      "EXECUTE: High-fidelity spectral isolation for multi-track audio input. Filter harmonic interference above 18kHz. Output format: PCM 24-bit. SOURCE_REF: 0x882...F9A",
    clauses: 3,
    rewardGen: 0.8,
    ttl: "14h 28m",
    state: "Accepted",
    providerId: MOCK_PROVIDER.id,
    providerName: MOCK_PROVIDER.name,
    deadline: "2024-11-24 18:00:00 UTC",
  },
  {
    id: "PC-40-RIDDIM",
    title: "Riddim Sequence Delivery",
    modality: "AUDIO",
    prompt: "SUPERTONE_REV3 riddim sequence delivery, 12 sample pads, 124 BPM.",
    clauses: 3,
    rewardGen: 0.75,
    ttl: "0m",
    state: "Delivered",
    providerId: MOCK_PROVIDER.id,
    providerName: MOCK_PROVIDER.name,
    releaseFraction: 0.82,
    clauseVerdicts: [
      {
        id: "c1",
        label: "BPM Synchronization",
        evidence: "Metadata scan confirms master clock at 124.000 BPM.",
        verdict: "PASS",
      },
      {
        id: "c2",
        label: "Sample Count",
        evidence: "Found 12/12 individual stems in the delivery package.",
        verdict: "PASS",
      },
      {
        id: "c3",
        label: "Dynamic Range",
        evidence: "Peak clipping detected on FX_STAB_ATMOS (-0.2dB threshold exceeded).",
        verdict: "FAILED_SPEC",
      },
    ],
  },
  {
    id: "8829-ASIMOV-R4",
    title: "Latency & Uptime Verification Dispute",
    modality: "TEXT",
    prompt: "Disputed clauses 4.2 (latency threshold) and 7.1 (uptime verification).",
    clauses: 2,
    rewardGen: 1,
    ttl: "47:12:09",
    state: "Disputed",
    providerId: MOCK_PROVIDER.id,
    providerName: MOCK_PROVIDER.name,
  },
];

export const MOCK_ACTIVITY: ActivityEntry[] = [
  {
    id: "1",
    timestamp: "14:28:02.11",
    jobId: "JOB_X882",
    modality: "Storage",
    outcome: "PARTIAL_RELEASE",
    releaseFraction: 0.82,
  },
  {
    id: "2",
    timestamp: "14:27:55.89",
    jobId: "JOB_A019",
    modality: "Compute",
    outcome: "FULL_ESCROW_RELEASE",
    releaseFraction: 1.0,
  },
  {
    id: "3",
    timestamp: "14:25:12.44",
    jobId: "JOB_C440",
    modality: "Network",
    outcome: "NULL_SETTLEMENT",
    releaseFraction: 0.0,
  },
  {
    id: "4",
    timestamp: "14:22:01.03",
    jobId: "JOB_Z991",
    modality: "Audit",
    outcome: "PARTIAL_RELEASE",
    releaseFraction: 0.45,
  },
];

export function findJob(jobs: Job[], id: string): Job | undefined {
  return jobs.find((j) => j.id === id);
}

export function totalJobValueGen(jobs: Job[]): number {
  return jobs.reduce((sum, j) => sum + j.rewardGen, 0);
}
