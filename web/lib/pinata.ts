import type { GeneratedOutput, PinResult } from "./generation-types";

// Confirmed live against docs.pinata.cloud on 2026-07-28: free plan = 1GB
// storage, 500 files, 10GB bandwidth/mo, 10K API requests/mo, 1 gateway --
// no credit card required to sign up or to stay within those limits. This
// is the current v3 Files API (Pinata retired the old pinning-by-hash API
// alongside their 2026 pricing overhaul).
const UPLOAD_URL = "https://uploads.pinata.cloud/v3/files";

export async function pinToIPFS(
  output: GeneratedOutput,
  filename: string
): Promise<PinResult> {
  const jwt = process.env.PINATA_JWT;
  if (!jwt) {
    throw new Error("PINATA_JWT is not set");
  }
  const gatewayDomain = process.env.PINATA_GATEWAY_DOMAIN || "gateway.pinata.cloud";

  const form = new FormData();
  const blob = new Blob([new Uint8Array(output.buffer)], { type: output.contentType });
  form.append("file", blob, filename);
  form.append("network", "public");
  form.append("name", filename);

  const res = await fetch(UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${jwt}` },
    body: form,
  });

  const data = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const message = data?.error?.message || data?.error || res.statusText;
    throw new Error(`Pinata upload error (${res.status}): ${JSON.stringify(message)}`);
  }

  const cid: string | undefined = data?.data?.cid;
  if (!cid) {
    throw new Error(`Pinata response had no cid: ${JSON.stringify(data).slice(0, 300)}`);
  }

  return {
    cid,
    gatewayUrl: `https://${gatewayDomain}/ipfs/${cid}`,
    size: data?.data?.size ?? output.buffer.length,
  };
}
