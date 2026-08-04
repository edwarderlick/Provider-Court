export type Modality = "TEXT" | "IMAGE" | "AUDIO";

export interface GenerateRequest {
  modality: Modality;
  prompt: string;
}

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
  modality: Modality;
  contentType: string;
}
