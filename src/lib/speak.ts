// Lightweight Web Speech API helper for voice guidance (Korean)
export function speak(text: string, opts?: { interrupt?: boolean; rate?: number }) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  if (opts?.interrupt !== false) synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ko-KR";
  u.rate = opts?.rate ?? 1;
  u.pitch = 1;
  synth.speak(u);
}

export function stopSpeaking() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
}
