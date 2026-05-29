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

  // read_all(전체 본문)과 summary(구조화 요약)를 병렬로 요청
  const [readData, sumData] = await Promise.all([
    postWebhook({ file_base64, mode: "read_all" }),
    postWebhook({ file_base64, mode: "summary" }),
  ]);

  // ----- ReadAll: PDF 원문 텍스트만 -----
  // 응답에서 가장 긴 평문(JSON 아닌) 문자열을 찾는 폴백
  const longestPlainString = (d: Record<string, unknown>): string => {
    let best = "";
    const walk = (v: unknown) => {
      if (typeof v === "string") {
        const trimmed = v.trim();
        if (trimmed.length < 80) return; // 너무 짧으면 무시
        if (parseMaybeJSON(trimmed)) return; // JSON 문자열은 제외
        if (trimmed.length > best.length) best = trimmed;
      } else if (Array.isArray(v)) {
        v.forEach(walk);
      } else if (v && typeof v === "object") {
        Object.values(v as Record<string, unknown>).forEach(walk);
      }
    };
    walk(d);
    return best;
  };
  const extractReadAll = (d: Record<string, unknown>): string => {
    const t =
      pickString(d.readall) ||
      pickString(d.read_all) ||
      pickString(d.full_text) ||
      pickString(d.direct_text) ||
      pickString(d.text) ||
      pickString(d.content) ||
      pickString(d.body) ||
      pickString(d.output);
    if (t) return t;
    const st = pickString(d.summary_text);
    if (st && !parseMaybeJSON(st)) return st;
    return longestPlainString(d);
  };
  const readall = extractReadAll(readData) || extractReadAll(sumData);
  // 디버깅: 응답 구조 확인용
  if (typeof window !== "undefined") {
    console.log("[sendAnalysis] readData keys:", Object.keys(readData));
    console.log("[sendAnalysis] sumData keys:", Object.keys(sumData));
    if (!readall) console.warn("[sendAnalysis] readall 비어있음. 응답:", readData);
  }


  // ----- Summary: 구조화된 핵심 요약 -----
  const extractSummary = (d: Record<string, unknown>): string => {
    if (
      typeof d.subject === "string" ||
      typeof d.key_concept === "string" ||
      typeof d.summary === "string" ||
      typeof d.keywords !== "undefined"
    ) {
      const s = buildSummaryText(d);
      if (s) return s;
    }
    const candidates = [pickString(d.summary), pickString(d.summary_text)];
    for (const c of candidates) {
      const parsed = parseMaybeJSON(c);
      if (parsed && typeof parsed === "object") {
        const s = buildSummaryText(parsed as Record<string, unknown>);
        if (s) return s;
      }
      if (c && !parsed) return c;
    }
    return "";
  };
  const summary = extractSummary(sumData) || extractSummary(readData);

  const qa_ready =
    typeof sumData.qa_ready === "boolean"
      ? sumData.qa_ready
      : typeof readData.qa_ready === "boolean"
        ? readData.qa_ready
        : true;

  return {
    result: { readall, summary, qa_ready, raw: { read: readData, summary: sumData } },
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
