import { generateText } from "./gemini";
import { generateImage, generateAudio } from "./cloudflare";
import { pinToIPFS } from "./pinata";
import type { GenerateResponse } from "./generation-types";
import type { JobModality } from "./types";

// The real generation+pin logic, merged in from the former provider-service
// project (see contract/README.md's deployment-consolidation note) -- was a
// second, separately-deployed Vercel project reachable only via a URL env
// var, which meant one broken/misconfigured value silently killed every
// purchase's generation step while escrow/adjudication kept working fine.
// This is now an in-process function: every caller (the /api/generate route
// below, autoFulfillOrder, and the legacy manual deliver route) calls it
// directly, no outbound fetch to a second service.
export async function generateContent(modality: JobModality, prompt: string): Promise<GenerateResponse> {
  const output =
    modality === "TEXT"
      ? await generateText(prompt)
      : modality === "IMAGE"
        ? await generateImage(prompt)
        : await generateAudio(prompt);

  const filename = `job-${Date.now()}.${output.extension}`;
  const pinned = await pinToIPFS(output, filename);

  return {
    modality,
    contentType: output.contentType,
    cid: pinned.cid,
    gatewayUrl: pinned.gatewayUrl,
    size: pinned.size,
  };
}
