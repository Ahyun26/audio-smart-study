import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BigButton } from "@/components/BigButton";
import { VoiceAnnouncer } from "@/components/VoiceAnnouncer";
import { speak, stopSpeaking } from "@/lib/speak";

export const Route = createFileRoute("/result")({
  head: () => ({
    meta: [{ title: "분석 결과 - AI 학습 도우미" }],
  }),
  component: Result,
});

const DOC = {
  title: "전기회로의 기초",
  type: "강의자료",
  pages: 5,
  tables: 3,
  keywords: ["전압", "전류", "저항"],
  summary:
    "이번 강의의 핵심은 옴의 법칙입니다. 전압은 전류와 저항의 곱과 같습니다. 저항이 직렬로 연결되면 전체 저항은 각 저항의 합과 같고, 병렬 연결에서는 역수의 합의 역수가 됩니다.",
  full: "1장. 전기회로 개요. 전기회로는 전압원, 전류, 저항으로 구성됩니다. 옴의 법칙에 따르면 전압은 전류 곱하기 저항입니다. 2장. 직렬과 병렬. 직렬 회로에서는 전류가 일정하고, 병렬 회로에서는 전압이 일정합니다. 3장. 응용. 키르히호프의 법칙을 통해 복잡한 회로를 해석할 수 있습니다.",
};

function Result() {
  const navigate = useNavigate();
  const [playing, setPlaying] = useState<"summary" | "full" | null>(null);

  const announcement =
    `분석이 완료되었습니다. 전체 ${DOC.pages}페이지 문서입니다. ${DOC.type}이며 표가 ${DOC.tables}개 포함되어 있습니다. 핵심 키워드는 ${DOC.keywords.join(", ")}입니다.`;

  const play = (kind: "summary" | "full") => {
    stopSpeaking();
    setPlaying(kind);
    speak(kind === "summary" ? DOC.summary : DOC.full, { interrupt: true });
  };

  const stop = () => {
    stopSpeaking();
    setPlaying(null);
    speak("재생을 중지했습니다.");
  };

  return (
    <AppShell title="분석 결과" back={{ to: "/" }}>
      <VoiceAnnouncer message={announcement} />

      <div className="flex-1 flex flex-col gap-6 max-w-xl mx-auto w-full mt-4">
        {/* 문서 정보 카드 */}
        <section
          className="rounded-3xl bg-card border-2 border-border p-6 shadow-[var(--shadow-soft)]"
          aria-label="문서 정보"
        >
          <p className="text-base font-semibold text-muted-foreground uppercase tracking-wide">
            문서 정보
          </p>
          <h2 className="mt-2 text-2xl font-bold leading-tight">{DOC.title}</h2>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <Stat label="페이지" value={`${DOC.pages}`} />
            <Stat label="유형" value={DOC.type} />
            <Stat label="표" value={`${DOC.tables}개`} />
          </dl>
        </section>

        {/* 핵심 키워드 */}
        <section
          className="rounded-3xl bg-accent border-2 border-primary/20 p-6"
          aria-label="핵심 키워드"
        >
          <p className="text-base font-semibold text-accent-foreground/80 uppercase tracking-wide">
            핵심 키워드
          </p>
          <ul className="mt-4 flex flex-wrap gap-3" role="list">
            {DOC.keywords.map((k) => (
              <li
                key={k}
                className="px-5 py-3 rounded-2xl bg-card border-2 border-border text-xl font-bold"
              >
                {k}
              </li>
            ))}
          </ul>
        </section>

        {/* 액션 */}
        <section className="flex flex-col gap-4 pt-2" aria-label="듣기 옵션">
          <BigButton
            onClick={() => play("summary")}
            aria-label="핵심 요약 듣기. 두 번 탭하여 재생합니다."
            aria-pressed={playing === "summary"}
          >
            {playing === "summary" ? "▶ 재생 중 · 핵심 요약" : "핵심 요약 듣기"}
          </BigButton>
          <BigButton
            variant="secondary"
            onClick={() => play("full")}
            aria-label="전체 내용 듣기. 두 번 탭하여 재생합니다."
            aria-pressed={playing === "full"}
          >
            {playing === "full" ? "▶ 재생 중 · 전체 내용" : "전체 내용 듣기"}
          </BigButton>

          {playing && (
            <BigButton variant="ghost" onClick={stop} aria-label="재생 중지">
              ■ 중지
            </BigButton>
          )}
        </section>

        <button
          onClick={() => {
            stopSpeaking();
            navigate({ to: "/" });
          }}
          className="mt-2 text-lg font-semibold text-muted-foreground underline underline-offset-4 py-3"
        >
          새 문서 분석하기
        </button>
      </div>
    </AppShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted px-3 py-4 text-center">
      <dt className="text-sm font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-xl font-bold">{value}</dd>
    </div>
  );
}
