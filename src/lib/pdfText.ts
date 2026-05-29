// 클라이언트에서 PDF 텍스트를 추출 (pdfjs-dist 사용)
import * as pdfjsLib from "pdfjs-dist";
// Vite worker import
// @ts-expect-error - vite ?url
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

if (typeof window !== "undefined") {
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;
}

function stripMarkdown(s: string): string {
  return s
    // 코드펜스
    .replace(/```[\s\S]*?```/g, "")
    // 이미지/링크 라벨
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    // 표 구분선
    .replace(/^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/gm, "")
    // 헤더 # 기호
    .replace(/^#{1,6}\s+/gm, "")
    // 인용 >
    .replace(/^\s*>\s?/gm, "")
    // 굵게/기울임 ** *
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    // 남은 마크다운 기호 제거
    .replace(/[#*|>]/g, "")
    .replace(/(^|\s)-{2,}(\s|$)/g, "$1$2")
    // 표 파이프
    .replace(/\s*\|\s*/g, " ")
    // 대괄호
    .replace(/[\[\]]/g, "")
    // 다중 공백 정리
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractPdfTextFromFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const parts: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it) => ("str" in it ? (it as { str: string }).str : ""))
      .join(" ");
    if (pageText.trim()) parts.push(pageText);
  }
  return stripMarkdown(parts.join("\n\n"));
}
