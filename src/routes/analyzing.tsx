import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { VoiceAnnouncer } from "@/components/VoiceAnnouncer";
import { speak } from "@/lib/speak";

export const Route = createFileRoute("/analyzing")({
  head: () => ({ meta: [{ title: "분석 중 — AI 학습 도우미" }] }),
  component: Analyzing,
});

const STEPS = [
  "PDF 텍스트 추출",
  "녹음 파일 분석",
  "핵심 키워드 추출",
  "음성 생성",
];

function Analyzing() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (step >= STEPS.length) {
      const t = setTimeout(() => navigate({ to: "/result" }), 600);
      return () => clearTimeout(t);
    }
    speak(`${STEPS[step]} 단계입니다.`);
    const t = setTimeout(() => setStep((s) => s + 1), 1400);
    return () => clearTimeout(t);
  }, [step, navigate]);

  const progress = Math.min(100, Math.round((step / STEPS.length) * 100));

  return (
    <AppShell title="분석 중">
      <VoiceAnnouncer message="문서를 분석 중입니다. 잠시만 기다려 주세요." />

      <div className="flex-1 flex flex-col max-w-xl mx-auto w-full mt-6">
        <div
          className="rounded-3xl bg-card border-2 border-border p-8 shadow-[var(--shadow-soft)]"
          role="region"
          aria-label="분석 진행 상태"
        >
          <div className="flex items-baseline justify-between mb-4">
            <span className="text-lg font-semibold text-muted-foreground">
              진행률
            </span>
            <span
              className="text-5xl font-bold tabular-nums"
              aria-live="polite"
            >
              {progress}%
            </span>
          </div>
          <div
            className="h-5 w-full rounded-full bg-muted overflow-hidden"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <ul className="mt-8 space-y-3" aria-label="분석 단계">
          {STEPS.map((label, i) => {
            const done = i < step;
            const active = i === step;
            return (
              <li
                key={label}
                className={[
                  "flex items-center gap-4 rounded-2xl border-2 px-5 py-5 text-xl font-semibold transition-colors",
                  done
                    ? "border-success bg-success/5 text-foreground"
                    : active
                      ? "border-primary bg-accent text-foreground"
                      : "border-border bg-card text-muted-foreground",
                ].join(" ")}
              >
                <span
                  aria-hidden
                  className={[
                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold",
                    done
                      ? "bg-success text-success-foreground"
                      : active
                        ? "bg-primary text-primary-foreground animate-pulse"
                        : "bg-muted text-muted-foreground",
                  ].join(" ")}
                >
                  {done ? "✓" : active ? "…" : "○"}
                </span>
                <span className="flex-1">{label}</span>
                <span className="sr-only">
                  {done ? "완료" : active ? "진행 중" : "대기"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </AppShell>
  );
}
