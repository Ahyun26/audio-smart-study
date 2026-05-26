import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { BigButton } from "@/components/BigButton";
import { VoiceAnnouncer } from "@/components/VoiceAnnouncer";
import { speak } from "@/lib/speak";

export const Route = createFileRoute("/recent")({
  head: () => ({ meta: [{ title: "최근 문서 — AI 학습 도우미" }] }),
  component: Recent,
});

const RECENT = [
  { id: 1, title: "전기회로의 기초", date: "오늘", pages: 5 },
  { id: 2, title: "선형대수 입문", date: "어제", pages: 12 },
  { id: 3, title: "운영체제 강의 1주차", date: "3일 전", pages: 8 },
];

function Recent() {
  const navigate = useNavigate();
  return (
    <AppShell title="최근 문서" back={{ to: "/" }}>
      <VoiceAnnouncer
        message={`최근 문서 목록입니다. 총 ${RECENT.length}개의 문서가 있습니다.`}
      />

      <ul className="flex flex-col gap-4 max-w-xl mx-auto w-full mt-4" role="list">
        {RECENT.map((doc) => (
          <li key={doc.id}>
            <BigButton
              variant="secondary"
              onClick={() => {
                speak(`${doc.title} 문서를 엽니다.`);
                navigate({ to: "/result" });
              }}
              aria-label={`${doc.title}, ${doc.date}, ${doc.pages}페이지. 두 번 탭하여 열기.`}
              description={`${doc.date} · ${doc.pages}페이지`}
              className="text-left items-start"
            >
              {doc.title}
            </BigButton>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
