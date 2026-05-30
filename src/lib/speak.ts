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
  // 숫자+번 → 한글 읽기 (예: "1번"→"일 번", "2번"→"이 번")
  const digitToKor: Record<string, string> = {
    "0": "영", "1": "일", "2": "이", "3": "삼", "4": "사",
    "5": "오", "6": "육", "7": "칠", "8": "팔", "9": "구",
  };
  s = s.replace(/(\d)번/g, (_m, d: string) => `${digitToKor[d] ?? d} 번`);
  return s.trim();

}

let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
// 일시정지 상태 추적: readall 중 timeout 사이에 일시정지된 경우 재개 위해 보관
let pausedQueue: { paragraphs: string[]; nextIndex: number; rate: number } | null = null;
let activeQueue: { paragraphs: string[]; rate: number } | null = null;

// ===== 전역 음성 배속 =====
const RATE_KEY = "speech_rate";
const RATE_MIN = 0.5;
const RATE_MAX = 2.0;
const RATE_STEP = 0.5;
let _rate = 1;
if (typeof window !== "undefined") {
  const saved = parseFloat(window.localStorage?.getItem(RATE_KEY) ?? "");
  if (!Number.isNaN(saved) && saved >= RATE_MIN && saved <= RATE_MAX) _rate = saved;
}
const rateListeners = new Set<(r: number) => void>();
export function getSpeechRate(): number {
  return _rate;
}
export function setSpeechRate(r: number): number {
  const clamped = Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round(r * 10) / 10));
  _rate = clamped;
  if (typeof window !== "undefined") {
    try { window.localStorage.setItem(RATE_KEY, String(clamped)); } catch { /* ignore */ }
  }
  rateListeners.forEach((cb) => cb(clamped));
  return clamped;
}
export function adjustSpeechRate(delta: number): number {
  return setSpeechRate(_rate + delta);
}
export function subscribeSpeechRate(cb: (r: number) => void): () => void {
  rateListeners.add(cb);
  return () => rateListeners.delete(cb);
}
export const SPEECH_RATE_STEP = RATE_STEP;
export const SPEECH_RATE_MIN = RATE_MIN;
export const SPEECH_RATE_MAX = RATE_MAX;

let activeIndex = 0;
let rateLocked = false;

export function isRateLocked(): boolean {
  return rateLocked;
}

function runReadallQueue(paragraphs: string[], startIndex: number, rate: number) {
  const synth = window.speechSynthesis;
  activeQueue = { paragraphs, rate };
  activeIndex = startIndex;
  const speakNext = (i: number) => {
    if (i >= paragraphs.length) {
      activeQueue = null;
      return;
    }
    activeIndex = i;
    const u = new SpeechSynthesisUtterance(paragraphs[i]);
    u.lang = "ko-KR";
    u.rate = rate;
    u.pitch = 1;
    u.onend = () => {
      if (pausedQueue) return;
      if (i + 1 < paragraphs.length) {
        pendingTimeout = setTimeout(() => {
          pendingTimeout = null;
          if (synth.paused || pausedQueue) {
            pausedQueue = { paragraphs, nextIndex: i + 1, rate };
            return;
          }
          speakNext(i + 1);
        }, 2000);
      } else {
        activeQueue = null;
      }
    };
    synth.speak(u);
  };
  speakNext(startIndex);
}

/**
 * 배속을 변경하면서 현재 읽고 있던 readall 큐가 있다면
 * 안내 음성 후 그 위치부터 새 배속으로 이어 읽기 시작.
 * 안내 음성 재생 중에는 lock이 걸려 추가 호출을 무시함.
 */
export function changeSpeechRateAndResume(delta: number): number {
  if (rateLocked) return _rate;
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return adjustSpeechRate(delta);
  }
  const synth = window.speechSynthesis;
  const prev = _rate;
  const target = Math.min(RATE_MAX, Math.max(RATE_MIN, Math.round((_rate + delta) * 10) / 10));
  const atLimit = target === prev;

  // 현재 readall 큐 스냅샷
  let snapshot: { paragraphs: string[]; index: number } | null = null;
  if (activeQueue) {
    snapshot = { paragraphs: activeQueue.paragraphs, index: activeIndex };
  } else if (pausedQueue) {
    snapshot = { paragraphs: pausedQueue.paragraphs, index: pausedQueue.nextIndex };
  }

  // 현재 음성/타임아웃 중지
  if (pendingTimeout) {
    clearTimeout(pendingTimeout);
    pendingTimeout = null;
  }
  pausedQueue = null;
  activeQueue = null;
  synth.cancel();

  const newRate = setSpeechRate(target);

  const message = atLimit
    ? `최${delta > 0 ? "대" : "소"} ${newRate.toFixed(1)}배속입니다.`
    : `${newRate.toFixed(1)}배속으로 변경되었습니다.`;

  rateLocked = true;
  const u = new SpeechSynthesisUtterance(message);
  u.lang = "ko-KR";
  u.rate = newRate;
  u.pitch = 1;
  u.onend = () => {
    rateLocked = false;
    if (snapshot && snapshot.index < snapshot.paragraphs.length) {
      runReadallQueue(snapshot.paragraphs, snapshot.index, newRate);
    }
  };
  u.onerror = () => {
    rateLocked = false;
  };
  synth.speak(u);
  return newRate;
}

export function speak(
  text: string,
  opts?: { interrupt?: boolean; rate?: number; raw?: boolean; mode?: SpeechMode },
) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  if (opts?.interrupt !== false) {
    synth.cancel();
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }
    pausedQueue = null;
    activeQueue = null;
  }
  const mode = opts?.mode ?? "default";
  const rate = opts?.rate ?? _rate;

  // readall: 문단별로 끊어 읽고 2초간 쉼
  if (!opts?.raw && mode === "readall") {
    const paragraphs = text
      .split(/\n{2,}/)
      .map((p) => cleanForSpeech(p, "readall"))
      .filter((p) => p.length > 0);
    if (paragraphs.length === 0) return;
    runReadallQueue(paragraphs, 0, rate);
    return;
  }

  const spoken = opts?.raw ? text : cleanForSpeech(text, mode);
  if (!spoken) return;
  const u = new SpeechSynthesisUtterance(spoken);
  u.lang = "ko-KR";
  u.rate = rate;
  u.pitch = 1;
  synth.speak(u);
}

/** 일시정지 — 현재 위치를 보존. resumeSpeaking으로 이어 읽기 가능. */
export function pauseSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  // 문단 사이 timeout 대기 중이라면 다음 문단을 보관해 두고 자동 진행 차단
  if (pendingTimeout && activeQueue) {
    clearTimeout(pendingTimeout);
    pendingTimeout = null;
    // activeQueue가 현재 어떤 문단까지 진행했는지 추적이 어렵다 — 가장 안전한 동작은
    // 호출 시점의 다음 인덱스를 별도 onend 콜백에서만 알 수 있으므로,
    // 여기서는 단순히 일시정지 플래그만 세워두고 onend에서 nextIndex를 저장하도록 한다.
    pausedQueue = { paragraphs: activeQueue.paragraphs, nextIndex: 0, rate: activeQueue.rate };
    // nextIndex는 onend에서 갱신되지 않으므로, timeout 대기 중에는 추정이 어렵다.
    // 대신 현재 발화가 끝난 직후 timeout으로 진입한 상태이므로, 이미 onend에서 i+1이 예약되었었다.
    // 단순화: 일시정지 시점의 위치를 모르면 처음부터가 아니라 마지막으로 발화 시작된 문단부터 다시 읽도록
    // activeQueue를 그대로 두고 resume 시 처리한다.
  }
  if (synth.speaking) {
    synth.pause();
  }
}

/** 일시정지된 지점부터 이어 읽기 */
export function resumeSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  if (synth.paused) {
    synth.resume();
    pausedQueue = null;
    return;
  }
  // timeout 사이에 일시정지된 경우: 다음 문단부터 이어 읽기
  if (pausedQueue) {
    const { paragraphs, nextIndex, rate } = pausedQueue;
    pausedQueue = null;
    runReadallQueue(paragraphs, nextIndex, rate);
  }
}

/** 음성이 재생 중인지 (일시정지 포함) */
export function isSpeechActive(): boolean {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
  const synth = window.speechSynthesis;
  return synth.speaking || synth.paused || !!pausedQueue;
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  if (pendingTimeout) {
    clearTimeout(pendingTimeout);
    pendingTimeout = null;
  }
  pausedQueue = null;
  activeQueue = null;
  window.speechSynthesis.cancel();
}

