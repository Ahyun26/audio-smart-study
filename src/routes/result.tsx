import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BigButton } from "@/components/BigButton";
import { VoiceAnnouncer } from "@/components/VoiceAnnouncer";
import { speak, stopSpeaking, pauseSpeaking, resumeSpeaking } from "@/lib/speak";
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

type Section = "readall" | "summary" | "qa";

function Result() {
  const navigate = useNavigate();
  const qaInputRef = useRef<HTMLTextAreaElement>(null);

  const [fileB64, setFileB64] = useState("");
  const [meta, setMeta] = useState<AnalysisMeta>({});

  const [page, setPage] = useState<"menu" | "detail">("menu");
  const [section, setSection] = useState<Section | null>(null);

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playState, setPlayState] = useState<"idle" | "playing" | "paused">("idle");

  const [question, setQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [qaError, setQaError] = useState<string | null>(null);

  useEffect(() => {
    setMeta(loadMeta());
    const b64 = sessionStorage.getItem("analysis_file_base64") ?? "";
    setFileB64(b64);
    return () => stopSpeaking();
  }, []);

  const playText = async (text: string, mode: "readall" | "summary") => {
    stopSpeaking();
    setPlayState("playing");
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

  const goBackToMenu = () => {
    if (typeof window !== "undefined") window.speechSynthesis.cancel();
    stopSpeaking();
    setPage("menu");
    setSection(null);
    setContent("");
    setError(null);
    setLoading(false);
    setPlayState("idle");
    setQuestion("");
    setQaAnswer("");
    setQaError(null);
    setQaLoading(false);
  };

  const openSection = async (sec: Section) => {
    setSection(sec);
    setPage("detail");
    setContent("");
    setError(null);
    setQaAnswer("");
    setQaError(null);
    setQuestion("");

    if (!fileB64) {
      speak("PDF 데이터가 없습니다. 업로드 화면에서 다시 시작해 주세요.");
      return;
    }

    if (sec === "qa") {
      speak("질문하기 화면입니다. 질문을 입력해 주세요. 이전으로 돌아가려면 왼쪽 방향키를 누르세요.");
      setTimeout(() => qaInputRef.current?.focus(), 100);
      return;
    }

    setLoading(true);
    speak(
      sec === "readall"
        ? "분석중입니다. 이전 메뉴로 돌아가려면 왼쪽 방향키를 누르세요."
        : "분석중입니다. 이전 메뉴로 돌아가려면 왼쪽 방향키를 누르세요.",
    );
    try {
      const text = await fetchSection({ file_base64: fileB64, mode: sec });
      if (!text.trim()) {
        setError("내용을 받지 못했습니다.");
        speak("내용을 받지 못했습니다.");
        return;
      }
      setContent(text);
      await playText(text, sec);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      setError(msg);
      speak("내용을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const submitQuestion = async () => {
    const q = question.trim();
    if (!q) {
      speak("질문을 입력해 주세요.");
      qaInputRef.current?.focus();
      return;
    }
    if (!fileB64) {
      setQaError("PDF 데이터가 없습니다.");
      return;
    }
    setQaError(null);
    setQaLoading(true);
    speak("질문을 전송합니다.");
    try {
      const answer = await askQuestion({ file_base64: fileB64, question: q });
      setQaAnswer(answer);
      stopSpeaking();
      setPlayState("playing");
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
      const isInput = t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT");

      if (e.key === "ArrowLeft" && page === "detail") {
        if (isInput) return;
        e.preventDefault();
        goBackToMenu();
        return;
      }

      if (isInput) {
        if (e.key === "Escape") (t as HTMLElement).blur();
        return;
      }

      if (page === "menu") {
        if (e.key === "4") {
          e.preventDefault();
          openSection("readall");
        } else if (e.key === "5") {
          e.preventDefault();
          openSection("summary");
        } else if (e.key === "6") {
          e.preventDefault();
          openSection("qa");
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, fileB64]);

  const uploadedAt = meta.uploadedAt
    ? new Date(meta.uploadedAt).toLocaleString("ko-KR")
    : null;

  const announcement = page === "menu"
    ? "분석 메뉴입니다. 5번 전체 읽기, 6번 요약, 7번 질문하기."
    : "이전 메뉴로 돌아가려면 왼쪽 방향키를 누르세요.";

  return (
    <AppShell title="AI 학습 노트" back={{ to: "/" }}>
      <VoiceAnnouncer message={announcement} />

      <div className="flex-1 flex flex-col gap-6 max-w-2xl mx-auto w-full pb-10">
        {page === "menu" ? (
          <>
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

            <MenuButton shortcut="5" title="ReadAll · 전체 읽기" onClick={() => openSection("readall")} />
            <MenuButton shortcut="6" title="Summary · 요약" onClick={() => openSection("summary")} />
            <MenuButton shortcut="7" title="QA · 질문하기" onClick={() => openSection("qa")} />

            <button
              onClick={() => {
                stopSpeaking();
                navigate({ to: "/upload" });
              }}
              className="text-lg font-semibold text-muted-foreground underline underline-offset-4 py-3"
            >
              새 문서 분석하기
            </button>
          </>
        ) : (
          <section className="rounded-3xl border-2 border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-extrabold">
                {section === "readall" && "ReadAll · 전체 읽기"}
                {section === "summary" && "Summary · 요약"}
                {section === "qa" && "QA · 질문하기"}
              </h2>
              <BigButton
                variant="secondary"
                onClick={goBackToMenu}
                aria-label="메뉴로 돌아가기"
                className="max-w-[12rem]"
              >
                ← 메뉴
              </BigButton>
            </div>

            <p className="text-sm text-muted-foreground">
              이전으로 돌아가려면 왼쪽 방향키(←)를 누르세요.
            </p>

            {section !== "qa" && (
              <>
                {loading && (
                  <p className="text-lg font-medium text-muted-foreground">
                    불러오는 중...
                  </p>
                )}
                {error && (
                  <p role="alert" className="text-base font-medium text-destructive">
                    {error}
                  </p>
                )}
                {content && (
                  <>
                    <div className="flex gap-2 flex-wrap">
                      <BigButton
                        variant={playState === "playing" ? "secondary" : "primary"}
                        onClick={() => {
                          if (playState === "playing") {
                            pauseSpeaking();
                            setPlayState("paused");
                          } else if (playState === "paused") {
                            resumeSpeaking();
                            setPlayState("playing");
                          } else if (section === "readall" || section === "summary") {
                            playText(content, section);
                          }
                        }}
                        className="max-w-[10rem]"
                      >
                        {playState === "playing" ? "일시정지" : playState === "paused" ? "이어 듣기" : "다시 듣기"}
                      </BigButton>
                      {playState !== "idle" && (
                        <BigButton
                          variant="secondary"
                          onClick={() => {
                            stopSpeaking();
                            setPlayState("idle");
                          }}
                          className="max-w-[10rem]"
                        >
                          처음부터
                        </BigButton>
                      )}
                    </div>
                    <p className="text-lg leading-relaxed whitespace-pre-wrap break-words">
                      {content}
                    </p>
                  </>
                )}
              </>
            )}

            {section === "qa" && (
              <>
                <textarea
                  ref={qaInputRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={3}
                  placeholder="문서에 대해 궁금한 점을 입력하세요"
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
        )}
      </div>
    </AppShell>
  );
}

function MenuButton({
  shortcut,
  title,
  onClick,
}: {
  shortcut: string;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-3xl border-2 border-border bg-card p-6 text-left hover:border-primary transition-colors"
    >
      <h2 className="text-2xl font-extrabold">
        {title}{" "}
        <span className="text-base font-semibold text-muted-foreground">
          (단축키 {shortcut})
        </span>
      </h2>
    </button>
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
