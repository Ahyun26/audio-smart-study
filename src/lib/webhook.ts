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
  /** natural language text suitable for TTS */
  speech_text?: string;
};

function stripCodeFence(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

function buildSpeechText(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
  const p = parsed as Record<string, unknown>;
  const str = (k: string) => (typeof p[k] === "string" ? (p[k] as string).trim() : "");
  const subject = str("subject");
  const docType = str("doc_type");
  const keyConcept = str("key_concept");
  const summary = str("summary");
  const tableExplanation = str("table_explanation");
  const keywordsRaw = p["keywords"];
  const keywords = Array.isArray(keywordsRaw)
    ? keywordsRaw.filter((x) => typeof x === "string").join(", ")
    : typeof keywordsRaw === "string"
      ? keywordsRaw
      : "";

  const parts: string[] = [];
  if (subject && docType) parts.push(`이 문서는 ${subject} 관련 ${docType}입니다.`);
  else if (docType) parts.push(`이 문서는 ${docType}입니다.`);
  else if (subject) parts.push(`이 문서는 ${subject}에 관한 내용입니다.`);
  if (keyConcept) parts.push(`핵심 개념은 ${keyConcept}입니다.`);
  if (summary) parts.push(`요약하면, ${summary}`);
  if (tableExplanation) parts.push(`표 설명: ${tableExplanation}`);
  if (keywords) parts.push(`주요 키워드는 ${keywords}입니다.`);

  const text = parts.join(" ").trim();
  return text || undefined;
}

function buildDisplay(data: {
  mode: WebhookMode;
  summary_text?: string;
  direct_text?: string;
}): { display: string; parsed?: unknown; speech_text?: string } {
  if (data.mode === "read_all") {
    const t = data.direct_text ?? "";
    return { display: t, speech_text: t || undefined };
  }
  const raw = data.summary_text ?? "";
  if (raw) {
    const clean = stripCodeFence(raw);
    try {
      const parsed = JSON.parse(clean);
      const speech_text = buildSpeechText(parsed);
      return { parsed, display: JSON.stringify(parsed, null, 2), speech_text };
    } catch {
      return { display: clean, speech_text: clean };
    }
  }
  const t = data.direct_text ?? "";
  return { display: t, speech_text: t || undefined };
}

export async function sendToWebhook(input: {
  file: File;
  question: string;
  mode: WebhookMode;
  history?: unknown[];
}): Promise<WebhookResult> {
  const file_base64 = await fileToBase64(input.file);

  console.log("[webhook] file:", {
    name: input.file.name,
    size: input.file.size,
    type: input.file.type,
    base64Length: file_base64.length,
    base64Preview: file_base64.slice(0, 80),
    startsWithPdfMagic: file_base64.startsWith("JVBERi"), // "%PDF-" in base64
  });

  if (input.file.size === 0) {
    throw new Error("선택된 PDF 파일이 비어 있습니다. 다른 파일을 선택해 주세요.");
  }
  if (!file_base64.startsWith("JVBERi")) {
    throw new Error(
      "유효한 PDF 파일이 아닙니다. (PDF 매직 넘버 없음) 파일을 다시 확인해 주세요.",
    );
  }

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

  const { display, parsed, speech_text } = buildDisplay({
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
    speech_text,
  };
}

