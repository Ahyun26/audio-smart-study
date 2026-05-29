// Lightweight Web Speech API helper for voice guidance (Korean)

export type SpeechMode = "readall" | "summary" | "default";

/**
 * 마크다운 표를 "헤더1은 값1, 헤더2는 값2 입니다." 형식으로 변환.
 * | A | B |
 * |---|---|
 * | 1 | 2 |   →  "표. A는 1, B는 2 입니다."
 */
function convertMarkdownTables(input: string): string {
  const lines = input.split(/\r?\n/);
  const out: string[] = [];
  let i = 0;
  const isRow = (l: string) => /^\s*\|.*\|\s*$/.test(l);
  const isSep = (l: string) => /^\s*\|?\s*:?-{2,}.*\|/.test(l);
  const cells = (l: string) =>
    l
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  while (i < lines.length) {
    if (isRow(lines[i]) && i + 1 < lines.length && isSep(lines[i + 1])) {
      const headers = cells(lines[i]);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isRow(lines[i]) && !isSep(lines[i])) {
        rows.push(cells(lines[i]));
        i++;
      }
      out.push("표.");
      for (const r of rows) {
        const parts = headers.map((h, idx) => {
          const v = (r[idx] ?? "").trim();
          if (!v) return "";
          return h ? `${h}은(는) ${v}` : v;
        }).filter(Boolean);
        if (parts.length) out.push(parts.join(", ") + " 입니다.");
      }
      continue;
    }
    out.push(lines[i]);
    i++;
  }
  return out.join("\n");
}

/**
 * 마크다운/기호를 제거해서 TTS가 자연스럽게 읽도록 전처리.
 * mode: "readall"이면 표도 음성용 문장으로 변환.
 */
export function cleanForSpeech(input: string, mode: SpeechMode = "default"): string {
  if (!input) return "";
  let s = input;

  // readall: 표를 사람이 말하듯 변환 (마크다운 정리 전에 수행)
  if (mode === "readall") {
    s = convertMarkdownTables(s);
  }

  // summary: 이모지/머리표 제거 → 자연스러운 문장
  if (mode === "summary") {
    // 이모지(서로게이트/심볼) 제거
    s = s.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, " ");
    // "라벨: 내용" → "라벨. 내용"
    s = s.replace(/^([^\n:：]{1,20})[:：]\s*/gm, "$1. ");
  }


  // 코드 펜스
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`]+)`/g, "$1");
  // 이미지 ![alt](url) → "alt"
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_m, alt) => (alt ? `${alt}. ` : " "));
  // 링크 [text](url) → "text"
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // 헤딩 (### 등) 라인 시작
  s = s.replace(/^#{1,6}\s*/gm, "");
  // 인용 / 리스트 기호 라인 시작
  s = s.replace(/^\s*[>\-*+]\s+/gm, "");
  // 수평선 ---  ***
  s = s.replace(/^\s*([-*_])\1{2,}\s*$/gm, " ");
  // 표 구분자 / 남은 파이프
  s = s.replace(/\|/g, " ");
  // 볼드/이탤릭
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  // 연속된 -- 또는 ** 같은 잔여 기호
  s = s.replace(/-{2,}/g, " ");
  // 남은 마크다운 기호 제거
  s = s.replace(/[#*_>`~]/g, " ");
  // 괄호류 제거 (내용은 유지)
  s = s.replace(/[\[\]{}()]/g, " ");
  // 다중 공백/줄바꿈 정리
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  // 줄바꿈을 자연스러운 문장 구분으로
  if (mode === "readall" || mode === "summary") {
    s = s.replace(/[ \t]*\n[ \t]*/g, (m) => (m.includes("\n\n") ? ". " : " "));
    s = s.replace(/\.\s*\.+/g, ".");
    s = s.replace(/\s+([.,!?])/g, "$1");
    s = s.replace(/\s{2,}/g, " ");
  }
  return s.trim();
}

export function speak(
  text: string,
  opts?: { interrupt?: boolean; rate?: number; raw?: boolean; mode?: SpeechMode },
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  if (opts?.interrupt !== false) synth.cancel();
  const spoken = opts?.raw ? text : cleanForSpeech(text, opts?.mode ?? "default");
  if (!spoken) return;
  const u = new SpeechSynthesisUtterance(spoken);
  u.lang = "ko-KR";
  u.rate = opts?.rate ?? 1;
  u.pitch = 1;
  synth.speak(u);
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
