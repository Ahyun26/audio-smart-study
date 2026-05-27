import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BigButton } from "@/components/BigButton";
import { VoiceAnnouncer } from "@/components/VoiceAnnouncer";
import { speak } from "@/lib/speak";
import { sendToWebhook } from "@/lib/webhook";

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
  const audioRef = useRef<HTMLInputElement>(null);
  const [pdf, setPdf] = useState<Slot>(null);
  const [audio, setAudio] = useState<Slot>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const announcement =
    "파일 업로드 화면입니다. PDF 파일과 강의 녹음 파일을 업로드할 수 있습니다.";

  const start = async () => {
    setError(null);
    setSending(true);
    speak("문서를 분석 중입니다. 잠시만 기다려 주세요.");
    try {
      // 파일 메타데이터를 미리 저장 (분석 화면에서 사용)
      sessionStorage.setItem(
        "analysis_meta",
        JSON.stringify({
          pdfName: pdf?.name ?? null,
          audioName: audio?.name ?? null,
          uploadedAt: new Date().toISOString(),
        }),
      );
      const result = await sendToWebhook({
        pdf: pdf?.file ?? null,
        audio: audio?.file ?? null,
      });
      sessionStorage.setItem("analysis_result", JSON.stringify(result));
      navigate({ to: "/analyzing" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "알 수 없는 오류";
      setError(`Webhook 전송 실패: ${msg}`);
      speak("웹훅 전송에 실패했습니다. URL과 n8n 서버 상태를 확인하세요.");
      setSending(false);
    }
  };

  return (
    <AppShell title="파일 업로드" back={{ to: "/" }}>
      <VoiceAnnouncer message={announcement} />

      <div className="flex-1 flex flex-col gap-5 max-w-xl mx-auto w-full mt-4">
        <UploadCard
          label="PDF 강의 자료"
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
          label="강의 녹음 파일"
          hint="MP3, M4A, WAV 등 음성 파일"
          file={audio}
          accept="audio/*"
          inputRef={audioRef}
          onPick={(f) => {
            setAudio({ file: f, name: f.name, size: f.size });
            speak(`녹음 파일 ${f.name} 이 업로드되었습니다.`);
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
            disabled={(!pdf && !audio) || sending}
            aria-label="분석 시작"
            className="disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? "전송 중..." : "분석 시작"}
          </BigButton>
          <p className="text-center text-base text-muted-foreground mt-3">
            {pdf || audio
              ? "준비되었습니다. 분석을 시작하세요."
              : "파일을 하나 이상 업로드해 주세요."}
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
        ready
          ? "border-success bg-success/5"
          : "border-border bg-card hover:border-primary",
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
            ready
              ? "bg-success text-success-foreground"
              : "bg-muted text-muted-foreground",
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
