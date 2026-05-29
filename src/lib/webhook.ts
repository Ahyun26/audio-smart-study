// n8n webhook 연동
export const WEBHOOK_URL =
  "https://hp432300.app.n8n.cloud/webhook/docvoice/upload";

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

export type WebhookMode = "요약" | "질문";

export async function sendToWebhook(input: {
  file: File;
  question: string;
  mode: WebhookMode;
}): Promise<string> {
  const base64 = await fileToBase64(input.file);

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file: base64,
      question: input.question,
      mode: input.mode,
    }),
  });

  if (!res.ok) {
    throw new Error(`Webhook 응답 오류: ${res.status} ${res.statusText}`);
  }

  const text = await res.text();
  let answer = "";
  try {
    const data = text ? JSON.parse(text) : null;
    if (data && typeof data === "object") {
      answer =
        (data as { answer?: string }).answer ??
        (Array.isArray(data) && data[0]?.answer) ??
        "";
    }
    if (!answer) answer = text;
  } catch {
    answer = text;
  }

  return answer;
}
