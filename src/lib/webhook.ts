// n8n webhook 연동
// 사용자가 직접 URL을 변경할 수 있도록 localStorage 우선
const DEFAULT_WEBHOOK_URL =
  "http://localhost:5678/webhook-test/docvoice/upload";

export function getWebhookUrl(): string {
  if (typeof window === "undefined") return DEFAULT_WEBHOOK_URL;
  return localStorage.getItem("webhook_url") || DEFAULT_WEBHOOK_URL;
}

export function setWebhookUrl(url: string) {
  if (typeof window !== "undefined") localStorage.setItem("webhook_url", url);
}

async function fileToBase64(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)),
    );
  }
  return btoa(bin);
}

export type WebhookPayload = {
  pdf: { name: string; size: number; mime: string; base64: string } | null;
  audio: { name: string; size: number; mime: string; base64: string } | null;
  uploadedAt: string;
};

export async function sendToWebhook(input: {
  pdf: File | null;
  audio: File | null;
}): Promise<unknown> {
  const payload: WebhookPayload = {
    pdf: input.pdf
      ? {
          name: input.pdf.name,
          size: input.pdf.size,
          mime: input.pdf.type || "application/pdf",
          base64: await fileToBase64(input.pdf),
        }
      : null,
    audio: input.audio
      ? {
          name: input.audio.name,
          size: input.audio.size,
          mime: input.audio.type || "audio/mpeg",
          base64: await fileToBase64(input.audio),
        }
      : null,
    uploadedAt: new Date().toISOString(),
  };

  const res = await fetch(getWebhookUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Webhook 응답 오류: ${res.status} ${res.statusText}`);
  }

  // n8n이 JSON을 반환하지 않을 수도 있으므로 text 후 파싱
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}
