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

export type WebhookMode = "summary" | "read_all" | "qa";

export type WebhookResult = {
  success?: boolean;
  summary_text?: string;
  direct_text?: string;
  table_count?: number;
  image_count?: number;
  /** parsed summary_text (if JSON) or raw string */
  parsed?: unknown;
  /** human-readable text to display */
  display: string;
};

function stripCodeFence(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
function buildDisplay(data: {
  mode: WebhookMode;
  summary_text?: string;
  direct_text?: string;
}): { display: string; parsed?: unknown } {
  if (data.mode === "read_all") {
    return { display: data.direct_text ?? "" };
  }
  const raw = data.summary_text ?? "";
  if (raw) {
    const clean = stripCodeFence(raw);
    try {
      const parsed = JSON.parse(clean);
      return { parsed, display: JSON.stringify(parsed, null, 2) };
    } catch {
      return { display: clean };
    }
  }
  return { display: data.direct_text ?? "" };
}


export async function sendToWebhook(input: {
  file: File;
  question: string;
  mode: WebhookMode;
  history?: unknown[];
}): Promise<WebhookResult> {
  const file_base64 = await fileToBase64(input.file);

  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_base64,
      mode: input.mode,
      user_question: input.question,
      history: input.history ?? [],
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
  let data: Record<string, unknown> = {};
  try {
    const parsed = text ? JSON.parse(text) : null;
    if (Array.isArray(parsed)) data = (parsed[0] ?? {}) as Record<string, unknown>;
    else if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
  } catch {
    return { display: text };
  }

  const { display, parsed } = buildDisplay({

    mode: input.mode,
    summary_text: typeof data.summary_text === "string" ? data.summary_text : undefined,
    direct_text: typeof data.direct_text === "string" ? data.direct_text : undefined,
  });

  return {
    success: typeof data.success === "boolean" ? data.success : undefined,
    summary_text: typeof data.summary_text === "string" ? data.summary_text : undefined,
    direct_text: typeof data.direct_text === "string" ? data.direct_text : undefined,
    table_count: typeof data.table_count === "number" ? data.table_count : undefined,
    image_count: typeof data.image_count === "number" ? data.image_count : undefined,
    parsed,
    display,
  };
}

