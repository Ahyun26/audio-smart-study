import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BigButton } from "@/components/BigButton";
import { VoiceAnnouncer } from "@/components/VoiceAnnouncer";
import { speak, stopSpeaking } from "@/lib/speak";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [{ title: "AI 학습 노트" }],
  }),
  component: Result,
});

type AnalysisMeta = {
  pdfName?: string | null;
  audioName?: string | null;
  question?: string;
  mode?: "요약" | "질문";
  uploadedAt?: string;
};

function loadAnswer(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = sessionStorage.getItem("analysis_result");
    if (!raw) return "";
    const parsed = JSON.parse(raw);
    const data = Array.isArray(parsed) ? parsed[0] : parsed;
    if (typeof data === "string") return data;
    if (data && typeof data === "object") {
      const a = (data as { answer?: unknown }).answer;
      if (typeof a === "string") return a;
    }
    return raw;
  } catch {
    return "";
  }
}

function loadMeta(): AnalysisMeta {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem("analysis_meta");
    if (!raw) return {};
    return JSON.parse(raw) as AnalysisMeta;
  } catch {
    return {};
  }
}

function Result() {
  const navigate = useNavigate();
  const [answer, setAnswer] = useState("");
  const [meta, setMeta] = useState<AnalysisMeta>({});
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setAnswer(loadAnswer());
    setMeta(loadMeta());
    return () => stopSpeaking();
  }, []);

  const hasAnswer = answer.trim().length > 0;
  const announcement = hasAnswer
    ? "분석이 완료되었습니다. 결과를 확인하세요."
    : "분석 결과를 불러오는 중입니다.";


  const play = () => {
    if (!hasAnswer) return;
    stopSpeaking();
    setPlaying(true);
    speak(answer, { interrupt: true });
  };

  const stop = () => {
    stopSpeaking();
    setPlaying(false);
  };

  const uploadedAt = meta.uploadedAt
    ? new Date(meta.uploadedAt).toLocaleString("ko-KR")
    : null;

  return (
    <AppShell title="AI 학습 노트" back={{ to: "/" }}>
      <VoiceAnnouncer message={announcement} />

      <div className="flex-1 flex flex-col gap-6 max-w-2xl mx-auto w-full pb-32">
        <section
          aria-label="문서 정보"
          className="rounded-2xl border-2 border-border bg-card px-6 py-5"
        >
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            문서 정보
          </p>
          <dl className="mt-3 grid grid-cols-1 gap-y-2 text-lg">
            {meta.pdfName && <Row label="PDF" value={meta.pdfName} />}
            {meta.audioName && <Row label="녹음" value={meta.audioName} />}
            {meta.mode && <Row label="모드" value={meta.mode} />}
            {meta.question && <Row label="질문" value={meta.question} />}
            {uploadedAt && <Row label="업로드" value={uploadedAt} />}
          </dl>
        </section>

        <header className="border-b-4 border-foreground pb-4">
          <p className="text-base font-semibold text-primary">
            AI 분석 결과
          </p>
          <h2 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight">
            {meta.mode === "질문" ? "질문에 대한 답변" : "문서 요약"}
          </h2>
        </header>

        {hasAnswer ? (
          <section
            aria-label="분석 결과 본문"
            className="rounded-3xl border-2 border-border bg-card p-6"
          >
            <p className="text-lg leading-relaxed whitespace-pre-wrap break-words">
              {answer}
            </p>
          </section>
        ) : (
          <section
            role="alert"
            className="rounded-3xl border-2 border-destructive bg-destructive/5 p-6"
          >
            <p className="text-lg font-bold text-destructive">
              분석 결과가 없습니다.
            </p>
            <p className="mt-2 text-base text-muted-foreground">
              업로드 화면에서 PDF를 다시 분석해 주세요.
            </p>
          </section>
        )}

        <button
          onClick={() => {
            stopSpeaking();
            navigate({ to: "/upload" });
          }}
          className="text-lg font-semibold text-muted-foreground underline underline-offset-4 py-3"
        >
          새 문서 분석하기
        </button>
      </div>

      {hasAnswer && (
        <div
          className="fixed bottom-0 inset-x-0 bg-background/95 backdrop-blur border-t-2 border-border px-4 py-3"
          role="region"
          aria-label="듣기"
        >
          <div className="max-w-2xl mx-auto grid grid-cols-2 gap-2">
            <BigButton
              onClick={play}
              aria-label="결과 음성으로 듣기"
              variant={playing ? "secondary" : "primary"}
            >
              {playing ? "다시 듣기" : "음성으로 듣기"}
            </BigButton>
            <BigButton
              onClick={stop}
              aria-label="음성 재생 중지"
              variant="secondary"
              disabled={!playing}
            >
              중지
            </BigButton>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="font-bold text-muted-foreground shrink-0 w-20">
        {label}
      </dt>
      <dd className="font-medium break-all">{value}</dd>
    </div>
  );
}
