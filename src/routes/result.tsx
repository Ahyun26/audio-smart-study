import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BigButton } from "@/components/BigButton";
import { VoiceAnnouncer } from "@/components/VoiceAnnouncer";
import { speak, stopSpeaking } from "@/lib/speak";
import { expandImagesForSpeech, hasImageMarkdown } from "@/lib/imageDescribe";
import { askQuestion } from "@/lib/webhook";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [{ title: "AI 학습 노트" }],
  }),
  component: Result,
});

type AnalysisMeta = {
  pdfName?: string | null;
  audioName?: string | null;
  uploadedAt?: string;
};

type StoredResult = {
  readall?: string;
  summary?: string;
  qa_ready?: boolean;
};

function loadResult(): StoredResult {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem("analysis_result");
    if (!raw) return {};
    const data = JSON.parse(raw);
    if (data && typeof data === "object") return data as StoredResult;
    return {};
  } catch {
    return {};
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

type Section = "readall" | "summary";

function Result() {
  const navigate = useNavigate();
  const qaInputRef = useRef<HTMLTextAreaElement>(null);
  const [readall, setReadall] = useState("");
  const [summary, setSummary] = useState("");
  const [qaReady, setQaReady] = useState(false);
  const [meta, setMeta] = useState<AnalysisMeta>({});
  const [playing, setPlaying] = useState<Section | null>(null);

  const [question, setQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaAnswer, setQaAnswer] = useState("");
  const [qaError, setQaError] = useState<string | null>(null);

  useEffect(() => {
    const r = loadResult();
    setReadall(r.readall ?? "");
    setSummary(r.summary ?? "");
    setQaReady(!!r.qa_ready);
    setMeta(loadMeta());
    return () => stopSpeaking();
  }, []);

  const playSection = async (section: Section, text: string) => {
    if (!text.trim()) {
      speak(section === "readall" ? "전체 내용이 없습니다." : "요약 내용이 없습니다.");
      return;
    }
    if (playing === section) {
      stopSpeaking();
      setPlaying(null);
      return;
    }
    stopSpeaking();
    setPlaying(section);
    if (hasImageMarkdown(text)) {
      speak("이미지 설명을 불러옵니다. 잠시만 기다려 주세요.");
      try {
        const expanded = await expandImagesForSpeech(text);
        speak(expanded, { interrupt: true });
      } catch {
        speak(text, { interrupt: true });
      }
    } else {
      speak(text, { interrupt: true });
    }
  };

  const submitQuestion = async () => {
    const q = question.trim();
    if (!q) {
      speak("질문을 입력해 주세요.");
      qaInputRef.current?.focus();
      return;
    }
    const file_base64 =
      typeof window !== "undefined"
        ? sessionStorage.getItem("analysis_file_base64") ?? ""
        : "";
    if (!file_base64) {
      setQaError("PDF 데이터가 만료되었습니다. 업로드 화면에서 다시 분석해 주세요.");
      return;
    }
    setQaError(null);
    setQaLoading(true);
    speak("질문을 전송합니다.");
    try {
      const answer = await askQuestion({ file_base64, question: q });
      setQaAnswer(answer);
      speak("답변이 도착했습니다.", { interrupt: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      setQaError(`질문 전송 실패: ${msg}`);
      speak("질문 전송에 실패했습니다.");
    } finally {
      setQaLoading(false);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) {
        if (e.key === "Escape") (t as HTMLElement).blur();
        return;
      }
      if (e.key === "5") {
        e.preventDefault();
        playSection("readall", readall);
      } else if (e.key === "6") {
        e.preventDefault();
        playSection("summary", summary);
      } else if (e.key === "7") {
        e.preventDefault();
        speak("질문 입력란으로 이동합니다. 이에스시 키로 종료합니다.");
        qaInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [readall, summary, playing]);

  const hasAny = readall.trim() || summary.trim();
  const announcement = hasAny
    ? "분석이 완료되었습니다. 5번 전체 읽기, 6번 요약 듣기, 7번 질문하기."
    : "분석 결과를 불러오는 중입니다.";

  const uploadedAt = meta.uploadedAt
    ? new Date(meta.uploadedAt).toLocaleString("ko-KR")
    : null;

  return (
    <AppShell title="AI 학습 노트" back={{ to: "/" }}>
      <VoiceAnnouncer message={announcement} />

      <div className="flex-1 flex flex-col gap-6 max-w-2xl mx-auto w-full pb-10">
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
            {uploadedAt && <Row label="업로드" value={uploadedAt} />}
          </dl>
          <p className="mt-4 text-base text-muted-foreground">
            단축키: 5 전체 읽기 · 6 요약 · 7 질문 입력
          </p>
        </section>

        {!hasAny && (
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

        <SectionCard
          shortcut="5"
          title="ReadAll · 전체 내용"
          text={readall}
          playing={playing === "readall"}
          onPlay={() => playSection("readall", readall)}
        />

        <SectionCard
          shortcut="6"
          title="Summary · 요약"
          text={summary}
          playing={playing === "summary"}
          onPlay={() => playSection("summary", summary)}
        />

        <section
          aria-label="질문하기"
          className="rounded-3xl border-2 border-border bg-card p-6 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-extrabold">QA · 질문하기 (단축키 7)</h2>
            <span
              className={[
                "text-sm font-bold rounded-full px-3 py-1",
                qaReady
                  ? "bg-success/10 text-success"
                  : "bg-muted text-muted-foreground",
              ].join(" ")}
            >
              {qaReady ? "준비됨" : "비활성"}
            </span>
          </div>
          <textarea
            ref={qaInputRef}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="문서에 대해 궁금한 점을 입력하세요 (종료: Esc)"
            disabled={!qaReady || qaLoading}
            className="w-full rounded-2xl border-2 border-border bg-background px-4 py-3 text-lg outline-none focus:border-primary disabled:opacity-50"
          />
          <BigButton
            onClick={submitQuestion}
            disabled={!qaReady || qaLoading || !question.trim()}
            aria-label="질문 보내기"
            className="disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {qaLoading ? "전송 중..." : "질문 보내기"}
          </BigButton>
          {qaError && (
            <p role="alert" className="text-base font-medium text-destructive">
              {qaError}
            </p>
          )}
          {qaAnswer && (
            <div className="rounded-2xl border-2 border-success/40 bg-success/5 p-4">
              <p className="text-sm font-bold text-success uppercase tracking-wider mb-2">
                답변
              </p>
              <p className="text-lg leading-relaxed whitespace-pre-wrap break-words">
                {qaAnswer}
              </p>
            </div>
          )}
        </section>

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
    </AppShell>
  );
}

function SectionCard({
  shortcut,
  title,
  text,
  playing,
  onPlay,
}: {
  shortcut: string;
  title: string;
  text: string;
  playing: boolean;
  onPlay: () => void;
}) {
  const has = text.trim().length > 0;
  return (
    <section
      aria-label={title}
      className="rounded-3xl border-2 border-border bg-card p-6 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold">
          {title} <span className="text-base font-semibold text-muted-foreground">(단축키 {shortcut})</span>
        </h2>
        <BigButton
          variant={playing ? "secondary" : "primary"}
          onClick={onPlay}
          disabled={!has}
          aria-label={playing ? "읽기 중지" : "음성으로 듣기"}
          className="max-w-[10rem] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {playing ? "중지" : "듣기"}
        </BigButton>
      </div>
      {has ? (
        <p className="text-lg leading-relaxed whitespace-pre-wrap break-words">
          {text}
        </p>
      ) : (
        <p className="text-base text-muted-foreground">내용이 없습니다.</p>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <dt className="font-bold text-muted-foreground shrink-0 w-20">{label}</dt>
      <dd className="font-medium break-all">{value}</dd>
    </div>
  );
}
