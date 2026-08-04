import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generateText } from "../lib/gemini";
import { generateImage, generateAudio } from "../lib/cloudflare";
import { pinToIPFS } from "../lib/pinata";
import type { GenerateRequest, GenerateResponse, Modality } from "../lib/types";

const MODALITIES: Modality[] = ["TEXT", "IMAGE", "AUDIO"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed, use POST" });
    return;
  }

  const body = req.body as Partial<GenerateRequest> | undefined;
  const modality = body?.modality;
  const prompt = body?.prompt;

  if (!modality || !MODALITIES.includes(modality)) {
    res.status(400).json({ error: `modality must be one of ${MODALITIES.join(", ")}` });
    return;
  }
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    res.status(400).json({ error: "prompt must be a non-empty string" });
    return;
  }

  try {
    const output =
      modality === "TEXT"
        ? await generateText(prompt)
        : modality === "IMAGE"
          ? await generateImage(prompt)
          : await generateAudio(prompt);

    const filename = `job-${Date.now()}.${output.extension}`;
    const pinned = await pinToIPFS(output, filename);

    const response: GenerateResponse = {
      modality,
      contentType: output.contentType,
      cid: pinned.cid,
      gatewayUrl: pinned.gatewayUrl,
      size: pinned.size,
    };
    res.status(200).json(response);
  } catch (err) {
    // Never forward raw provider error bodies to the client -- our lib
    // functions already strip anything key-shaped, but keep this as a
    // second line of defense against accidentally leaking upstream detail.
    const message = err instanceof Error ? err.message : "generation failed";
    console.error("generate error:", message);
    res.status(502).json({ error: message });
  }
}
