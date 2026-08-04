import type { JobModality } from "./types";

// Merged in from the former provider-service project -- reuses this app's
// own JobModality (TEXT/IMAGE/AUDIO) instead of a second, duplicate
// "Modality" type, since generation now runs in the same process as
// everything else that already uses JobModality.

export interface GeneratedOutput {
  /** Raw bytes of the generated artifact. */
  buffer: Buffer;
  /** MIME type of `buffer`, e.g. "text/plain", "image/jpeg", "audio/mpeg". */
  contentType: string;
  /** File extension (no dot), used for the pinned filename. */
  extension: string;
}

export interface PinResult {
  cid: string;
  gatewayUrl: string;
  size: number;
}

export interface GenerateResponse extends PinResult {
  modality: JobModality;
  contentType: string;
}
