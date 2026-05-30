import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BigButton } from "@/components/BigButton";
import { VoiceAnnouncer } from "@/components/VoiceAnnouncer";
import { speak, stopSpeaking } from "@/lib/speak";
import { expandImagesForSpeech, hasImageMarkdown } from "@/lib/imageDescribe";
import { askQuestion, fetchSection } from "@/lib/webhook";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [{ title: "AI 학습 노트" }],
  }),
  component: Result,
});

type AnalysisMeta = {
  pdfName?: string | null;
  uploadedAt?: string;
};

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

  const [fileB64, setFileB64] = useState("");
  const [meta, setMeta] = useState<AnalysisMeta>({});

  const [readall, setReadall] = useState("");
  const [summary, setSummary] = useState("");
  const [readallLoading, setReadallLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [readallError, setReadallError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [playing, setPlaying] = useState<Section | null>(null);
  const [qaActive, setQaActive] = useState(false);

  const [question, setQuestion] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaAnswer, setQaAnswer] = useState("");
  const [qaError, setQaError] = useState<string | null>(null);

  useEffect(() => {
    setMeta(loadMeta());
    const b64 = sessionStorage.getItem("analysis_file_base64") ?? "";
    setFileB64(b64);
    return () => stopSpeaking();
  }, []);

  const playText = async (section: Section, text: string) => {
    stopSpeaking();
    setPlaying(section);
    const mode = section;
    if (hasImageMarkdown(text)) {
      try {
        const expanded = await expandImagesForSpeech(text);
        speak(expanded, { interrupt: true, mode });
      } catch {
        speak(text, { interrupt: true, mode });
      }
    } else {
      speak(text, { interrupt: true, mode });
    }
  };

  const handleSection = async (section: Section) => {
    if (!fileB64) {
      speak("PDF 데이터가 없습니다. 업로드 화면에서 다시 시작해 주세요.");
      return;
    }
    // 같은 섹션을 다시 누르면 재생 중지 또는 토글
    if (playing === section) {
      stopSpeaking();
      setPlaying(null);
      return;
    }

    const cached = section === "readall" ? readall : summary;
    if (cached) {
      await playText(section, cached);
      return;
    }

    if (section === "readall") {
      setReadallLoading(true);
      setReadallError(null);
      speak("전체 내용을 불러옵니다. 잠시만 기다려 주세요.");
    } else {
      setSummaryLoading(true);
      setSummaryError(null);
      speak("요약을 불러옵니다. 잠시만 기다려 주세요.");
    }

    try {
      const text = await fetchSection({ file_base64: fileB64, mode: section });
      if (!text.trim()) {
        const msg = "내용을 받지 못했습니다.";
        if (section === "readall") setReadallError(msg);
        else setSummaryError(msg);
        speak(msg);
        return;
      }
      if (section === "readall") setReadall(text);
      else setSummary(text);
      await playText(section, text);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      if (section === "readall") setReadallError(msg);
      else setSummaryError(msg);
      speak("내용을 불러오지 못했습니다.");
    } finally {
      if (section === "readall") setReadallLoading(false);
      else setSummaryLoading(false);
    }
  };

  const activateQA = () => {
    setQaActive(true);
    speak("질문 입력란으로 이동합니다. 이에스시 키로 종료합니다.");
    setTimeout(() => qaInputRef.current?.focus(), 50);
  };

  const submitQuestion = async () => {
    const q = question.trim();
    if (!q) {
      speak("질문을 입력해 주세요.");
      qaInputRef.current?.focus();
      return;
    }
    if (!fileB64) {
      setQaError("PDF 데이터가 없습니다. 업로드 화면에서 다시 시작해 주세요.");
      return;
    }
    setQaError(null);
    setQaLoading(true);
    speak("질문을 전송합니다.");
    try {
      const answer = await askQuestion({ file_base64: fileB64, question: q });
      setQaAnswer(answer);
      speak(answer, { interrupt: true, mode: "summary" });
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
        handleSection("readall");
      } else if (e.key === "6") {
        e.preventDefault();
        handleSection("summary");
      } else if (e.key === "7") {
        e.preventDefault();
        activateQA();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fileB64, readall, summary, playing]);

  const announcement =
    "분석 메뉴입니다. 5번 전체 읽기, 6번 요약, 7번 질문하기.";

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
            {uploadedAt && <Row label="업로드" value={uploadedAt} />}
          </dl>
          <p className="mt-4 text-base text-muted-foreground">
            단축키: 5 전체 읽기 · 6 요약 · 7 질문하기
          </p>
        </section>

        <MenuCard
          shortcut="5"
          title="ReadAll · 전체 읽기"
          loading={readallLoading}
          playing={playing === "readall"}
          loaded={!!readall}
          text={readall}
          error={readallError}
          onClick={() => handleSection("readall")}
        />

        <MenuCard
          shortcut="6"
          title="Summary · 요약"
          loading={summaryLoading}
          playing={playing === "summary"}
          loaded={!!summary}
          text={summary}
          error={summaryError}
          onClick={() => handleSection("summary")}
        />

        <section
          aria-label="질문하기"
          className="rounded-3xl border-2 border-border bg-card p-6 space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-2xl font-extrabold">
              QA · 질문하기{" "}
              <span className="text-base font-semibold text-muted-foreground">
                (단축키 7)
              </span>
            </h2>
            {!qaActive && (
              <BigButton
                onClick={activateQA}
                aria-label="질문하기 시작"
                className="max-w-[10rem]"
              >
                시작
              </BigButton>
            )}
          </div>

          {qaActive && (
            <>
              <textarea
                ref={qaInputRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                placeholder="문서에 대해 궁금한 점을 입력하세요 (종료: Esc)"
                disabled={qaLoading || !fileB64}
                className="w-full rounded-2xl border-2 border-border bg-background px-4 py-3 text-lg outline-none focus:border-primary disabled:opacity-50"
              />
              <BigButton
                onClick={submitQuestion}
                disabled={qaLoading || !question.trim() || !fileB64}
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
            </>
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

function MenuCard({
  shortcut,
  title,
  loading,
  playing,
  loaded,
  text,
  error,
  onClick,
}: {
  shortcut: string;
  title: string;
  loading: boolean;
  playing: boolean;
  loaded: boolean;
  text: string;
  error: string | null;
  onClick: () => void;
}) {
  const label = loading
    ? "불러오는 중..."
    : playing
      ? "중지"
      : loaded
        ? "다시 듣기"
        : "불러오기";

  return (
    <section
      aria-label={title}
      className="rounded-3xl border-2 border-border bg-card p-6 space-y-4"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold">
          {title}{" "}
          <span className="text-base font-semibold text-muted-foreground">
            (단축키 {shortcut})
          </span>
        </h2>
        <BigButton
          variant={playing ? "secondary" : "primary"}
          onClick={onClick}
          disabled={loading}
          aria-label={label}
          className="max-w-[12rem] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {label}
        </BigButton>
      </div>

      {error && (
        <p role="alert" className="text-base font-medium text-destructive">
          {error}
        </p>
      )}

      {loaded && (
        <p className="text-lg leading-relaxed whitespace-pre-wrap break-words">
          {text}
        </p>
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
