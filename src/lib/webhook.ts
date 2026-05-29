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
 * 구조화된 핵심 요약 텍스트 생성 (subject/doc_type/key_concept/summary/table_explanation/keywords)
 */
function buildSummaryText(obj: Record<string, unknown>): string {
  const get = (k: string) => {
    const v = obj[k];
    if (typeof v === "string") return v.trim();
    if (Array.isArray(v)) return v.map((x) => String(x)).filter(Boolean).join(", ");
    if (v && typeof v === "object") {
      try {
        return JSON.stringify(v);
      } catch {
        return "";
      }
    }
    return "";
  };
  const subject = get("subject");
  const docType = get("doc_type");
  const keyConcept = get("key_concept");
  const summary = get("summary");
  const tableExp = get("table_explanation");
  const keywords = get("keywords");

  const lines: string[] = [];
  if (subject || docType) {
    lines.push(`📘 주제: ${[subject, docType].filter(Boolean).join(" · ")}`);
  }
  if (keyConcept) lines.push(`\n🔑 핵심 개념\n${keyConcept}`);
  if (summary) lines.push(`\n📝 요약\n${summary}`);
  if (tableExp) lines.push(`\n📊 표 설명\n${tableExp}`);
  if (keywords) lines.push(`\n🏷️ 키워드: ${keywords}`);
  return lines.join("\n").trim();
}

function parseMaybeJSON(s: string): unknown {
  if (!s) return null;
  const clean = stripCodeFence(s);
  try {
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

/**
 * 초기 분석: 전체 읽기 + 요약을 한 번에 요청.
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

  // ----- ReadAll: 전체 본문 텍스트 -----
  let readall =
    pickString(data.readall) ||
    pickString(data.read_all) ||
    pickString(data.full_text) ||
    pickString(data.direct_text) ||
    pickString(data.text);

  // summary_text가 JSON이 아닌 평문이면 readall로도 사용
  if (!readall) {
    const st = pickString(data.summary_text);
    const parsed = parseMaybeJSON(st);
    if (st && !parsed) readall = st;
  }

  // ----- Summary: 구조화된 핵심 요약 -----
  let summary = "";
  // 1) data 자체에 구조화 필드가 있는지
  if (
    typeof data.subject === "string" ||
    typeof data.key_concept === "string" ||
    typeof data.summary === "string" ||
    typeof data.keywords !== "undefined"
  ) {
    summary = buildSummaryText(data);
  }
  // 2) summary_text/summary 필드 안에 JSON이 들어있는 경우
  if (!summary) {
    const candidates = [pickString(data.summary), pickString(data.summary_text)];
    for (const c of candidates) {
      const parsed = parseMaybeJSON(c);
      if (parsed && typeof parsed === "object") {
        summary = buildSummaryText(parsed as Record<string, unknown>);
        if (summary) break;
      }
      if (!summary && c && !parsed) {
        summary = c; // 평문 요약
        break;
      }
    }
  }

  const qa_ready = typeof data.qa_ready === "boolean" ? data.qa_ready : true;

  return {
    result: { readall, summary, qa_ready, raw: data },
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
