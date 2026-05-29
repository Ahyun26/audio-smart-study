// Lightweight Web Speech API helper for voice guidance (Korean)

/**
 * 마크다운/기호를 제거해서 TTS가 자연스럽게 읽도록 전처리.
 * 이미지 (![alt](url))는 alt 텍스트만 남깁니다.
 * 이미지 본문 설명은 expandImagesForSpeech (lib/imageDescribe.ts) 사용.
 */
export function cleanForSpeech(input: string): string {
  if (!input) return "";
  let s = input;
  // 코드 펜스
  s = s.replace(/```[\s\S]*?```/g, " ");
  s = s.replace(/`([^`]+)`/g, "$1");
  // 이미지 ![alt](url) → "alt"
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, (_m, alt) => (alt ? `${alt}. ` : " "));
  // 링크 [text](url) → "text"
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
  // 헤딩 기호 (### 등) 라인 시작
  s = s.replace(/^#{1,6}\s*/gm, "");
  // 인용 / 리스트 기호 라인 시작
  s = s.replace(/^\s*[>\-*+]\s+/gm, "");
  // 표 구분자 |---|
  s = s.replace(/\|/g, " ");
  // 볼드/이탤릭 **x** *x* __x__ _x_
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  s = s.replace(/_([^_]+)_/g, "$1");
  // 남은 마크다운 기호 제거
  s = s.replace(/[#*_>`~]/g, " ");
  // 괄호류 제거 (내용은 유지)
  s = s.replace(/[\[\]{}()]/g, " ");
  // 다중 공백 정리
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

export function speak(text: string, opts?: { interrupt?: boolean; rate?: number; raw?: boolean }) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  if (opts?.interrupt !== false) synth.cancel();
  const spoken = opts?.raw ? text : cleanForSpeech(text);
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
