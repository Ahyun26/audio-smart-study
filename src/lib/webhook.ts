// 앱 서버를 통해 n8n webhook으로 전달
export const WEBHOOK_URL = "/api/webhook";

export type WebhookMode = "summary" | "read_all" | "qa" | "all";

export async function fileToBase64(file: File): Promise<string> {
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

export type AnalysisResult = {
  readall: string;
  summary: string;
  qa_ready: boolean;
  raw?: Record<string, unknown>;
};

function stripCodeFence(s: string): string {
  return s
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

function pickString(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object") {
    try {
      return JSON.stringify(v, null, 2);
    } catch {
      return "";
    }
  }
  return "";
}

async function postWebhook(payload: {
  file_base64: string;
  mode: WebhookMode;
  user_question?: string;
  history?: unknown[];
}): Promise<Record<string, unknown>> {
  const res = await fetch(WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      file_base64: payload.file_base64,
      mode: payload.mode,
      user_question: payload.user_question ?? "",
      history: payload.history ?? [],
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    let message = `Webhook 응답 오류: ${res.status} ${res.statusText}`;
    try {
      const data = text ? JSON.parse(text) : null;
      if (data && typeof data === "object") {
        const err = (data as { error?: string }).error;
        const det = (data as { details?: string }).details;
        if (err) message = det ? `${err} (${det})` : err;
      }
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }

  try {
    const parsed = text ? JSON.parse(text) : {};
    if (Array.isArray(parsed)) return (parsed[0] ?? {}) as Record<string, unknown>;
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    return { raw: text };
  } catch {
    return { raw: text };
  }
}

/**
 * 초기 분석: 전체 읽기 + 요약을 한 번에 요청.
 * n8n 응답: { readall, summary, qa_ready }
 */
export async function sendAnalysis(input: { file: File }): Promise<{
  result: AnalysisResult;
  file_base64: string;
}> {
  const file_base64 = await fileToBase64(input.file);

  if (input.file.size === 0) {
    throw new Error("선택된 PDF 파일이 비어 있습니다.");
  }
  if (!file_base64.startsWith("JVBERi")) {
    throw new Error("유효한 PDF 파일이 아닙니다.");
  }

  const data = await postWebhook({ file_base64, mode: "all" });

  // readall / summary 추출 (응답 키 변형 허용)
  const readallRaw =
    pickString(data.readall) ||
    pickString(data.read_all) ||
    pickString(data.direct_text);
  const summaryRaw =
    pickString(data.summary) || pickString(data.summary_text);

  // summary가 JSON 문자열인 경우 보기 좋게 변환
  let summary = summaryRaw;
  if (summary) {
    const clean = stripCodeFence(summary);
    try {
      const parsed = JSON.parse(clean);
      summary = typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
    } catch {
      summary = clean;
    }
  }

  const qa_ready =
    typeof data.qa_ready === "boolean" ? data.qa_ready : true;

  return {
    result: {
      readall: readallRaw,
      summary,
      qa_ready,
      raw: data,
    },
    file_base64,
  };
}

/**
 * QA: 저장된 file_base64를 사용해 질문을 전송하고 답변 텍스트를 반환.
 */
export async function askQuestion(input: {
  file_base64: string;
  question: string;
  history?: unknown[];
}): Promise<string> {
  const data = await postWebhook({
    file_base64: input.file_base64,
    mode: "qa",
    user_question: input.question,
    history: input.history,
  });
  const ans =
    pickString(data.answer) ||
    pickString(data.summary_text) ||
    pickString(data.direct_text) ||
    pickString(data.readall);
  const clean = stripCodeFence(ans);
  try {
    const parsed = JSON.parse(clean);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const a = (parsed as Record<string, unknown>).answer;
      if (typeof a === "string") return a;
      return JSON.stringify(parsed, null, 2);
    }
  } catch {
    /* ignore */
  }
  return clean;
}
