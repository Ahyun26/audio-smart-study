import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BigButton } from "@/components/BigButton";
import { VoiceAnnouncer } from "@/components/VoiceAnnouncer";
import { speak } from "@/lib/speak";
import { sendToWebhook, type WebhookMode } from "@/lib/webhook";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [{ title: "파일 업로드 — AI 학습 도우미" }],
  }),
  component: Upload,
});

type Slot = { file: File; name: string; size: number } | null;

const MODE_LABEL: Record<WebhookMode, string> = {
  read_all: "전체 읽기",
  summary: "요약",
  qa: "질문하기",
};

function Upload() {
  const navigate = useNavigate();
  const pdfRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLInputElement>(null);
  const questionRef = useRef<HTMLTextAreaElement>(null);
  const startRef = useRef<(() => void) | null>(null);

  const [pdf, setPdf] = useState<Slot>(null);
  const [audio, setAudio] = useState<Slot>(null);
  const [mode, setMode] = useState<WebhookMode>("summary");
  const [question, setQuestion] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);

  const announcement =
    "파일 업로드 화면입니다. 키보드 단축키. 1번 PDF 선택, 2번 녹음 선택, 3번 전체 읽기 모드, 4번 요약 모드, 5번 질문 모드, 6번 분석 시작, 0번 안내 다시 듣기, 백스페이스 이전 화면.";

  const helpText =
    "단축키 안내. 1번 PDF 파일 선택. 2번 녹음 파일 선택. 3번 전체 읽기 모드. 4번 요약 모드. 5번 질문 모드. 질문 모드일 때 큐 키를 누르면 질문 입력으로 이동합니다. 6번 분석 시작. 0번 이 안내 다시 듣기. 백스페이스 이전 화면.";

  const selectMode = (m: WebhookMode) => {
    setMode(m);
    speak(`${MODE_LABEL[m]} 모드를 선택했습니다.`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) {
        if (e.key === "Escape") {
          (t as HTMLElement).blur();
          speak("입력을 종료했습니다.");
        }
        return;
      }
      if (e.key === "1") {
        e.preventDefault();
        speak("PDF 파일 선택 창을 엽니다.");
        pdfRef.current?.click();
      } else if (e.key === "2") {
        e.preventDefault();
        speak("녹음 파일 선택 창을 엽니다.");
        audioRef.current?.click();
      } else if (e.key === "3") {
        e.preventDefault();
        selectMode("read_all");
      } else if (e.key === "4") {
        e.preventDefault();
        selectMode("summary");
      } else if (e.key === "5") {
        e.preventDefault();
        selectMode("qa");
      } else if (e.key === "q" || e.key === "Q") {
        e.preventDefault();
        if (mode === "qa") {
          speak("질문 입력란으로 이동합니다. 입력을 마치려면 이에스시 키를 누르세요.");
          questionRef.current?.focus();
        } else {
          speak("질문 모드가 아닙니다. 5번을 눌러 질문 모드를 선택하세요.");
        }
      } else if (e.key === "6" || e.key === "Enter") {
        e.preventDefault();
        startRef.current?.();
      } else if (e.key === "0" || e.key === "?" || e.key === "h" || e.key === "H") {
        e.preventDefault();
        speak(helpText);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        speak("이전 화면으로 이동합니다.");
        navigate({ to: "/" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate, mode]);

  const start = async () => {
    if (!pdf) {
      setError("PDF 파일을 업로드해 주세요.");
      return;
    }
    if (mode === "qa" && !question.trim()) {
      setError("질문 모드에서는 질문을 입력해 주세요. (단축키 Q)");
      speak("질문 모드에서는 질문을 입력해 주세요.");
      return;
    }
    setError(null);
    setAnswer(null);
    setSending(true);
    speak("문서를 분석 중입니다. 잠시만 기다려 주세요.");
    try {
      const q = mode === "qa" ? question.trim() : "";
      sessionStorage.setItem(
        "analysis_meta",
        JSON.stringify({
          pdfName: pdf?.name ?? null,
          audioName: audio?.name ?? null,
          question: q,
          mode,
          uploadedAt: new Date().toISOString(),
        }),
      );
      const result = await sendToWebhook({ file: pdf.file, question: q, mode });
      setAnswer(result.display);
      sessionStorage.setItem("analysis_result", JSON.stringify(result));
      speak("분석이 완료되었습니다.");
      navigate({ to: "/result" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      setError(`Webhook 전송 실패: ${msg}`);
      speak("웹훅 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    startRef.current = start;
  });

  return (
    <AppShell title="파일 업로드" back={{ to: "/" }}>
      <VoiceAnnouncer message={announcement} />

      <div className="flex-1 flex flex-col gap-5 max-w-xl mx-auto w-full mt-4">
        <div
          className="rounded-2xl bg-muted/40 border border-border px-5 py-4 text-base"
          role="note"
          aria-label="키보드 단축키 안내"
        >
          <p className="font-bold mb-1">키보드 단축키</p>
          <p className="text-muted-foreground">
            1: PDF · 2: 녹음 · 3: 전체읽기 · 4: 요약 · 5: 질문 · 6: 분석 시작 · 0: 안내 · Backspace: 뒤로
          </p>
        </div>

        <UploadCard
          label="PDF 강의 자료 (단축키 1)"
          hint="강의 PDF 파일을 선택하세요"
          file={pdf}
          accept="application/pdf"
          inputRef={pdfRef}
          onPick={(f) => {
            setPdf({ file: f, name: f.name, size: f.size });
            speak(`PDF 파일 ${f.name} 이 업로드되었습니다.`);
          }}
        />

        <UploadCard
          label="강의 녹음 파일 (선택, 단축키 2)"
          hint="MP3, M4A, WAV 등 음성 파일"
          file={audio}
          accept="audio/*"
          inputRef={audioRef}
          onPick={(f) => {
            setAudio({ file: f, name: f.name, size: f.size });
            speak(`녹음 파일 ${f.name} 이 업로드되었습니다.`);
          }}
        />

        <div className="rounded-3xl border-2 border-border bg-card p-6">
          <p className="text-xl font-bold mb-3">분석 모드 선택</p>
          <div
            role="radiogroup"
            aria-label="분석 모드"
            className="grid grid-cols-1 gap-3"
          >
            <ModeOption
              num={3}
              label="전체 읽기"
              hint="문서 본문을 그대로 읽어 줍니다"
              selected={mode === "read_all"}
              onClick={() => selectMode("read_all")}
            />
            <ModeOption
              num={4}
              label="요약"
              hint="핵심 개념과 요약을 정리합니다"
              selected={mode === "summary"}
              onClick={() => selectMode("summary")}
            />
            <ModeOption
              num={5}
              label="질문하기"
              hint="문서에 대해 질문하고 답변을 받습니다"
              selected={mode === "qa"}
              onClick={() => selectMode("qa")}
            />
          </div>

          {mode === "qa" && (
            <div className="mt-5">
              <label htmlFor="question" className="text-lg font-bold">
                질문 입력 <span className="text-base text-muted-foreground font-medium">(단축키 Q)</span>
              </label>
              <textarea
                id="question"
                ref={questionRef}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                rows={3}
                placeholder="문서에 대해 궁금한 점을 입력하세요 (종료: Esc)"
                className="mt-3 w-full rounded-2xl border-2 border-border bg-background px-4 py-3 text-lg outline-none focus:border-primary"
              />
            </div>
          )}
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-2xl border-2 border-destructive bg-destructive/5 px-5 py-4 text-base font-medium text-destructive"
          >
            {error}
          </div>
        )}

        {answer && (
          <div className="rounded-3xl border-2 border-success bg-success/5 p-6">
            <p className="text-xl font-bold mb-3">분석 결과</p>
            <p className="text-lg whitespace-pre-wrap break-words leading-relaxed">{answer}</p>
            <div className="mt-4">
              <BigButton
                variant="secondary"
                onClick={() => navigate({ to: "/result" })}
                aria-label="필기노트 보기"
              >
                필기노트 보기
              </BigButton>
            </div>
          </div>
        )}

        <div className="pt-4">
          <BigButton
            onClick={start}
            disabled={!pdf || sending}
            aria-label="분석 시작 (단축키 6)"
            className="disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? "전송 중..." : "분석 시작 (단축키 6)"}
          </BigButton>
          <p className="text-center text-base text-muted-foreground mt-3">
            {sending
              ? "n8n으로 전송 중입니다..."
              : pdf
                ? `${MODE_LABEL[mode]} 모드로 분석을 시작하세요.`
                : "PDF 파일을 업로드해 주세요."}
          </p>
        </div>
      </div>
    </AppShell>
  );
}

function ModeOption({
  num,
  label,
  hint,
  selected,
  onClick,
}: {
  num: number;
  label: string;
  hint: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={[
        "w-full rounded-2xl border-2 px-5 py-4 text-left transition-colors",
        "focus-visible:outline-4 focus-visible:outline-ring focus-visible:outline-offset-2",
        selected
          ? "border-primary bg-primary/5"
          : "border-border bg-background hover:border-primary",
      ].join(" ")}
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className={[
            "shrink-0 grid place-items-center w-10 h-10 rounded-full text-lg font-bold",
            selected ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
          ].join(" ")}
        >
          {num}
        </span>
        <div className="flex-1">
          <p className="text-lg font-bold">{label}</p>
          <p className="text-base text-muted-foreground">{hint}</p>
        </div>
        {selected && (
          <span className="text-sm font-bold text-primary" aria-hidden>
            선택됨
          </span>
        )}
      </div>
    </button>
  );
}

function UploadCard({
  label,
  hint,
  file,
  accept,
  inputRef,
  onPick,
}: {
  label: string;
  hint: string;
  file: Slot;
  accept: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onPick: (f: File) => void;
}) {
  const ready = !!file;
  return (
    <div
      className={[
        "rounded-3xl border-2 p-6 transition-colors",
        ready ? "border-success bg-success/5" : "border-border bg-card hover:border-primary",
      ].join(" ")}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        aria-label={`${label} 파일 선택`}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
        }}
      />
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-xl font-bold">{label}</p>
          <p className="text-base text-muted-foreground mt-1">{hint}</p>
        </div>
        <span
          aria-hidden
          className={[
            "shrink-0 rounded-full px-4 py-2 text-sm font-bold",
            ready ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground",
          ].join(" ")}
        >
          {ready ? "완료" : "대기"}
        </span>
      </div>

      {ready && file && (
        <p className="text-base font-medium mb-4 break-all">
          {file.name}
          <span className="ml-2 text-muted-foreground">
            ({(file.size / 1024 / 1024).toFixed(1)} MB)
          </span>
        </p>
      )}

      <BigButton
        variant={ready ? "secondary" : "primary"}
        onClick={() => inputRef.current?.click()}
        aria-label={`${label} ${ready ? "다시 선택" : "선택"}`}
      >
        {ready ? "다시 선택" : "파일 선택"}
      </BigButton>
    </div>
  );
}
