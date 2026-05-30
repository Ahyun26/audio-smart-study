// 최근 분석한 PDF 문서 목록을 localStorage에 보관한다.
// 사이즈 한계(localStorage ~5MB)를 고려해 최대 5개까지만 유지한다.

export type RecentDoc = {
  id: string;
  pdfName: string;
  uploadedAt: string; // ISO
  sizeBytes: number;
  fileBase64: string;
};

const KEY = "recent_docs_v1";
const MAX = 5;

export function getRecentDocs(): RecentDoc[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as RecentDoc[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveRecentDoc(doc: Omit<RecentDoc, "id">): RecentDoc {
  const entry: RecentDoc = { ...doc, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
  const current = getRecentDocs().filter(
    (d) => !(d.pdfName === entry.pdfName && d.sizeBytes === entry.sizeBytes),
  );
  const next = [entry, ...current].slice(0, MAX);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      // 용량 초과: 가장 오래된 것부터 제거하며 재시도
      const trimmed = next.slice(0, Math.max(1, next.length - 1));
      try {
        window.localStorage.setItem(KEY, JSON.stringify(trimmed));
      } catch {
        /* ignore */
      }
    }
  }
  return entry;
}

export function getRecentDoc(id: string): RecentDoc | null {
  return getRecentDocs().find((d) => d.id === id) ?? null;
}

export function removeRecentDoc(id: string): void {
  if (typeof window === "undefined") return;
  const next = getRecentDocs().filter((d) => d.id !== id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

export function formatRelativeKo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diffMs = Date.now() - then;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR");
}
