import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BigButton } from "@/components/BigButton";
import { VoiceAnnouncer } from "@/components/VoiceAnnouncer";
import { speak } from "@/lib/speak";
import { sendAnalysis } from "@/lib/webhook";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [{ title: "파일 업로드 — AI 학습 도우미" }],
  }),
  component: Upload,
});

type Slot = { file: File; name: string; size: number } | null;

function Upload() {
  const navigate = useNavigate();
  const pdfRef = useRef<HTMLInputElement>(null);
  const startRef = useRef<(() => void) | null>(null);

  const [pdf, setPdf] = useState<Slot>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);


  const announcement = pdf
    ? "파일이 선택되었습니다. 분석을 시작하려면 2번을 누르세요."
    : "파일을 선택하려면 1번을 누르세요.";

  const helpText = pdf
    ? "파일이 선택되었습니다. 분석을 시작하려면 2번을 누르세요. 백스페이스는 이전 화면입니다."
    : "파일을 선택하려면 1번을 누르세요. 백스페이스는 이전 화면입니다.";



  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT")) {
        if (e.key === "Escape") {
          (t as HTMLElement).blur();
        }
        return;
      }
      if (e.key === "1") {
        e.preventDefault();
        speak("PDF 파일 선택 창을 엽니다.");
        pdfRef.current?.click();
      } else if (e.key === "2" || e.key === "Enter") {
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
  }, [navigate]);

  const start = async () => {
    if (!pdf) {
      setError("PDF 파일을 업로드해 주세요.");
      speak("PDF 파일을 먼저 선택해 주세요.");
      return;
    }
    setError(null);
    setSending(true);
    speak("문서를 분석 중입니다. 잠시만 기다려 주세요.");
    try {
      sessionStorage.setItem(
        "analysis_meta",
        JSON.stringify({
          pdfName: pdf?.name ?? null,
          uploadedAt: new Date().toISOString(),
        }),
      );
      const { result, file_base64 } = await sendAnalysis({ file: pdf.file });
      sessionStorage.setItem("analysis_result", JSON.stringify(result));
      try {
        sessionStorage.setItem("analysis_file_base64", file_base64);
      } catch {
        // 용량 초과 등은 무시 (QA 비활성화)
      }
      speak("분석이 완료되었습니다.");
      navigate({ to: "/result" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      setError(`분석 실패: ${msg}`);
      speak("분석에 실패했습니다.");
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
            {pdf ? "2: 분석 시작 · Backspace: 뒤로" : "1: PDF 선택 · Backspace: 뒤로"}
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


        {error && (
          <div
            role="alert"
            className="rounded-2xl border-2 border-destructive bg-destructive/5 px-5 py-4 text-base font-medium text-destructive"
          >
            {error}
          </div>
        )}

        <div className="pt-4">
          <BigButton
            onClick={start}
            disabled={!pdf || sending}
            aria-label="분석 시작 (단축키 3)"
            className="disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? "전송 중..." : "분석 시작 (단축키 3)"}
          </BigButton>
          <p className="text-center text-base text-muted-foreground mt-3">
            {sending
              ? "n8n으로 전송 중입니다..."
              : pdf
                ? "분석을 시작하세요. 전체 읽기 · 요약 · 질문을 한 번에 준비합니다."
                : "PDF 파일을 업로드해 주세요."}
          </p>
        </div>
      </div>
    </AppShell>
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
