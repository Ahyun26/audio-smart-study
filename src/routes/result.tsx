import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AppShell } from "@/components/AppShell";
import { BigButton } from "@/components/BigButton";
import { VoiceAnnouncer } from "@/components/VoiceAnnouncer";
import { speak, stopSpeaking, pauseSpeaking, resumeSpeaking, getSpeechRate } from "@/lib/speak";
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
      if (sec === "readall") {
        stopSpeaking();
        setPlayState("playing");
        const synth = window.speechSynthesis;
        const messages = [
          "칠 번을 누르면 일시정지 또는 이어듣기입니다.",
          "팔 번을 누르면 처음부터 다시 들을 수 있습니다.",
          "왼쪽 방향키를 누르면 메뉴로 돌아갑니다.",
        ];
        const speakSequentially = (idx: number) => {
          if (idx >= messages.length) {
            playText(text, sec);
            return;
          }
          const u = new SpeechSynthesisUtterance(messages[idx]);
          u.lang = "ko-KR";
          u.rate = getSpeechRate();
          u.pitch = 1;
          u.onend = () => speakSequentially(idx + 1);
          synth.speak(u);
        };
        speakSequentially(0);
      } else {
        await playText(text, sec);
      }
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

      if (e.key === "ArrowLeft") {
        if (isInput) return;
        if (page === "detail") {
          e.preventDefault();
          e.stopPropagation();
          goBackToMenu();
          return;
        }
        if (page === "menu") {
          e.preventDefault();
          e.stopPropagation();
          stopSpeaking();
          navigate({ to: "/" });
          return;
        }
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
      } else if (page === "detail" && (section === "readall" || section === "summary") && content) {
        if (e.key === "7") {
          e.preventDefault();
          if (playState === "playing") {
            pauseSpeaking();
            setPlayState("paused");
          } else if (playState === "paused") {
            resumeSpeaking();
            setPlayState("playing");
          } else {
            playText(content, section);
          }
        } else if (e.key === "8") {
          e.preventDefault();
          playText(content, section);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [page, fileB64, section, content, playState]);

  const uploadedAt = meta.uploadedAt
    ? new Date(meta.uploadedAt).toLocaleString("ko-KR")
    : null;

  const announcement = page === "menu"
    ? "분석 메뉴입니다. 4번 전체 읽기, 5번 요약, 6번 질문하기."
    : "";


  return (
    <AppShell title={page === "menu" ? "AI 학습 메뉴" : "AI 학습 노트"} back={page === "detail" ? { onBack: goBackToMenu, label: "메뉴로 돌아가기" } : { to: "/" }}>
      <VoiceAnnouncer message={announcement} />

      <div className={`flex-1 flex flex-col gap-6 max-w-2xl mx-auto w-full pb-10 ${page === "detail" && (section === "readall" || section === "summary") && content ? "pb-32" : ""}`}>
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
                단축키: 4 전체 읽기 · 5 요약 · 6 질문하기
              </p>
            </section>

            <MenuButton shortcut="4" title="ReadAll · 전체 읽기" onClick={() => openSection("readall")} />
            <MenuButton shortcut="5" title="Summary · 요약" onClick={() => openSection("summary")} />
            <MenuButton shortcut="6" title="QA · 질문하기" onClick={() => openSection("qa")} />
          </>
        ) : (
          <section className="rounded-3xl border-2 border-border bg-card p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-extrabold">
                {section === "readall" && "ReadAll · 전체 읽기"}
                {section === "summary" && "Summary · 요약"}
                {section === "qa" && "QA · 질문하기"}
              </h2>
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
                  section === "readall" ? (
                    <div className="text-lg leading-relaxed break-words space-y-4
                      [&_h1]:text-3xl [&_h1]:font-extrabold [&_h1]:mt-6 [&_h1]:mb-2
                      [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-5 [&_h2]:mb-2
                      [&_h3]:text-xl [&_h3]:font-bold [&_h3]:mt-4 [&_h3]:mb-2
                      [&_p]:my-2
                      [&_strong]:font-bold
                      [&_em]:italic
                      [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2
                      [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2
                      [&_li]:my-1
                      [&_a]:text-primary [&_a]:underline
                      [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-base
                      [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-xl [&_pre]:overflow-x-auto
                      [&_blockquote]:border-l-4 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-muted-foreground
                      [&_table]:w-full [&_table]:border-collapse [&_table]:my-3
                      [&_th]:border-2 [&_th]:border-border [&_th]:px-3 [&_th]:py-2 [&_th]:font-bold [&_th]:bg-muted [&_th]:text-left
                      [&_td]:border-2 [&_td]:border-border [&_td]:px-3 [&_td]:py-2
                      [&_hr]:my-4 [&_hr]:border-border">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-lg leading-relaxed whitespace-pre-wrap break-words">
                      {content}
                    </p>
                  )
                )}
              </>
            )}

            {section === "qa" && (
              <>
                <textarea
                  ref={qaInputRef}
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      submitQuestion();
                    }
                  }}
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

      {page === "detail" && (section === "readall" || section === "summary") && content && (
        <nav
          aria-label="재생 컨트롤"
          className="fixed bottom-0 left-0 right-0 z-50 border-t-2 border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80"
        >
          <div className="max-w-2xl mx-auto grid grid-cols-3 gap-2 px-4 py-3">
            <button
              onClick={goBackToMenu}
              aria-label="메뉴로 돌아가기 (왼쪽 방향키)"
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border bg-background py-3 hover:border-primary transition-colors"
            >
              <span className="text-2xl" aria-hidden>←</span>
              <span className="text-sm font-semibold">메뉴 (←)</span>
            </button>
            <button
              onClick={() => {
                if (playState === "playing") {
                  pauseSpeaking();
                  setPlayState("paused");
                } else if (playState === "paused") {
                  resumeSpeaking();
                  setPlayState("playing");
                } else {
                  playText(content, section);
                }
              }}
              aria-label={playState === "playing" ? "일시정지 (단축키 7)" : "이어듣기 (단축키 7)"}
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border bg-background py-3 hover:border-primary transition-colors"
            >
              <span className="text-2xl" aria-hidden>{playState === "playing" ? "⏸" : "▶"}</span>
              <span className="text-sm font-semibold">
                {playState === "playing" ? "일시정지 (7)" : "이어듣기 (7)"}
              </span>
            </button>
            <button
              onClick={() => playText(content, section)}
              aria-label="처음부터 (단축키 8)"
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border-2 border-border bg-background py-3 hover:border-primary transition-colors"
            >
              <span className="text-2xl" aria-hidden>⏮</span>
              <span className="text-sm font-semibold">처음부터 (8)</span>
            </button>
          </div>
        </nav>
      )}
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
