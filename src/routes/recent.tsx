import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { BigButton } from "@/components/BigButton";
import { VoiceAnnouncer } from "@/components/VoiceAnnouncer";
import { speak } from "@/lib/speak";
import { getRecentDocs, getRecentDoc, removeRecentDoc, formatRelativeKo, type RecentDoc } from "@/lib/recentDocs";

export const Route = createFileRoute("/recent")({
  head: () => ({ meta: [{ title: "최근 문서 — AI 학습 도우미" }] }),
  component: Recent,
});

function Recent() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<RecentDoc[]>([]);

  useEffect(() => {
    setDocs(getRecentDocs());
  }, []);

  const openDoc = (id: string) => {
    const doc = getRecentDoc(id);
    if (!doc) {
      speak("문서를 찾을 수 없습니다.");
      return;
    }
    sessionStorage.setItem(
      "analysis_meta",
      JSON.stringify({ pdfName: doc.pdfName, uploadedAt: doc.uploadedAt }),
    );
    sessionStorage.setItem("analysis_file_base64", doc.fileBase64);
    sessionStorage.removeItem("analysis_result");
    speak(`${doc.pdfName} 문서를 엽니다.`);
    navigate({ to: "/result" });
  };

  const deleteDoc = (id: string, name: string) => {
    removeRecentDoc(id);
    setDocs(getRecentDocs());
    speak(`${name} 문서를 목록에서 삭제했습니다.`);
  };

  const announcement = docs.length === 0
    ? "최근 문서가 없습니다. 이전 화면으로 돌아가 PDF 파일을 업로드해 주세요."
    : `최근 문서 목록입니다. 총 ${docs.length}개의 문서가 있습니다.`;

  return (
    <AppShell title="최근 문서" back={{ to: "/" }}>
      <VoiceAnnouncer message={announcement} />

      {docs.length === 0 ? (
        <div className="max-w-xl mx-auto w-full mt-8 text-center space-y-6">
          <p className="text-xl font-medium text-muted-foreground">
            아직 분석한 문서가 없습니다.
          </p>
          <BigButton
            onClick={() => {
              speak("파일 업로드 화면으로 이동합니다.");
              navigate({ to: "/upload" });
            }}
            className="max-w-md mx-auto"
          >
            파일 업로드하기
          </BigButton>
        </div>
      ) : (
        <ul className="flex flex-col gap-4 max-w-xl mx-auto w-full mt-4" role="list">
          {docs.map((doc) => {
            const when = formatRelativeKo(doc.uploadedAt);
            const sizeMb = (doc.sizeBytes / 1024 / 1024).toFixed(1);
            return (
              <li key={doc.id} className="flex gap-3 items-stretch">
                <BigButton
                  variant="secondary"
                  onClick={() => openDoc(doc.id)}
                  aria-label={`${doc.pdfName}, ${when}, ${sizeMb} 메가바이트. 두 번 탭하여 열기.`}
                  description={`${when} · ${sizeMb} MB`}
                  className="text-left items-start flex-1"
                >
                  {doc.pdfName}
                </BigButton>
                <button
                  onClick={() => deleteDoc(doc.id, doc.pdfName)}
                  aria-label={`${doc.pdfName} 삭제`}
                  className="shrink-0 px-4 rounded-2xl border-2 border-border bg-card hover:border-destructive hover:text-destructive text-base font-bold transition-colors"
                >
                  삭제
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
