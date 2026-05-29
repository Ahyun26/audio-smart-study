// 앱 서버를 통해 n8n webhook으로 전달
export const WEBHOOK_URL = "/api/webhook";

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
    const text = await res.text();
    let message = `Webhook 응답 오류: ${res.status} ${res.statusText}`;

    try {
      const data = text ? JSON.parse(text) : null;
      if (data && typeof data === "object") {
        const errorMessage = (data as { error?: string }).error;
        const details = (data as { details?: string }).details;
        if (errorMessage) {
          message = details ? `${errorMessage} (${details})` : errorMessage;
        }
      }
    } catch {
      if (text) message = text;
    }

    throw new Error(message);
  }

  const text = await res.text();
  try {
    const data = text ? JSON.parse(text) : null;
    if (data && typeof data === "object") {
      return (data as { answer?: string }).answer ?? text;
    }
  } catch {
    return text;
  }

  return text;
}
