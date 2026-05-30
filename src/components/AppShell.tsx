import { useRouter } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { speak, changeSpeechRateAndResume, isRateLocked, SPEECH_RATE_STEP } from "@/lib/speak";
import { SpeedBadge } from "@/components/SpeedBadge";

interface AppShellProps {
  title: string;
  children: ReactNode;
  back?: { to?: string; label?: string; onBack?: () => void };
}

export function AppShell({ title, children, back }: AppShellProps) {
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
    if (back?.onBack) {
      back.onBack();
      return;
    }
    speak("이전 화면으로 이동합니다.");
    router.navigate({ to: back?.to ?? "/" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const isInput = !!(t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.isContentEditable));

      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        if (isInput) return;
        e.preventDefault();
        const current = getSpeechRate();
        const delta = e.key === "ArrowUp" ? SPEECH_RATE_STEP : -SPEECH_RATE_STEP;
        const next = adjustSpeechRate(delta);
        if (next === current) {
          const limit = e.key === "ArrowUp" ? SPEECH_RATE_MAX : SPEECH_RATE_MIN;
          speak(`최${e.key === "ArrowUp" ? "대" : "소"} ${limit.toFixed(1)}배속입니다.`, { interrupt: true, rate: next });
        } else {
          speak(`${next.toFixed(1)}배속으로 변경되었습니다.`, { interrupt: true, rate: next });
        }
        return;
      }

      if (!back) return;
      if (e.key !== "ArrowLeft") return;
      if (isInput) return;
      e.preventDefault();
      goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [back]);

  return (
    <main className="min-h-dvh bg-background text-foreground flex flex-col">
      <header className="px-6 pt-8 pb-4 flex items-center gap-4">
        {back ? (
          <button
            type="button"
            onClick={goBack}
            aria-label={back.label ?? "뒤로 가기 (왼쪽 방향키)"}
            className="min-h-14 min-w-14 inline-flex items-center justify-center rounded-2xl border-2 border-border text-xl font-bold hover:bg-accent"
          >
            ←
          </button>
        ) : (
          <div className="w-14" aria-hidden />
        )}
        <h1 className="text-2xl font-bold flex-1 text-center">{title}</h1>
        <SpeedBadge />
      </header>
      <div className="flex-1 px-6 pb-10 flex flex-col">{children}</div>
    </main>
  );
}
