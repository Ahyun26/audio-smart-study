import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { BigButton } from "@/components/BigButton";
import { VoiceAnnouncer } from "@/components/VoiceAnnouncer";
import { speak } from "@/lib/speak";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AI 학습 도우미 — 음성 우선 학습 보조" },
      {
        name: "description",
        content:
          "시각장애인과 저시력 사용자를 위한 AI 학습 보조 앱. PDF와 녹음 파일을 업로드하면 핵심 내용을 요약하고 음성으로 안내합니다.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();

  const announcement =
    "AI 학습 도우미가 실행되었습니다. 숫자 1번은 파일 업로드, 숫자 2번은 최근 문서입니다.";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "1") {
        speak("파일 업로드 화면으로 이동합니다.");
        navigate({ to: "/upload" });
      } else if (e.key === "2") {
        speak("최근 문서 목록을 엽니다.");
        navigate({ to: "/recent" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);


  return (
    <main className="min-h-dvh bg-background text-foreground flex flex-col">
      <VoiceAnnouncer message={announcement} />

      <section className="flex-1 px-6 flex flex-col items-center justify-center gap-10 text-center">
        <div className="space-y-2">
          <p className="text-base sm:text-lg font-medium text-muted-foreground/70">
            AI 학습 도우미
          </p>
          <h1 className="text-4xl sm:text-5xl font-bold leading-tight">
            오늘은 무엇을 학습할까요?
          </h1>
        </div>

        <BigButton
          aria-label="파일 업로드. 두 번 탭하여 PDF 파일을 업로드합니다."
          onClick={() => {
            speak("파일 업로드 화면으로 이동합니다.");
            navigate({ to: "/upload" });
          }}
          className="max-w-md py-12 text-3xl"
          description="단축키 1 · PDF"
        >
          파일 업로드
        </BigButton>

        <p
          className="text-lg text-muted-foreground max-w-md"
          aria-hidden
        >
          숫자 1번을 누르면 파일 업로드, 숫자 2번을 누르면 최근 문서가 열립니다.
        </p>
      </section>

      <footer className="px-6 pb-10 pt-4">
        <BigButton
          variant="secondary"
          aria-label="최근 문서 열기. 단축키 2."
          onClick={() => {
            speak("최근 문서 목록을 엽니다.");
            navigate({ to: "/recent" });
          }}
          className="max-w-md mx-auto"
        >
          최근 문서
        </BigButton>
      </footer>
    </main>
  );
}
