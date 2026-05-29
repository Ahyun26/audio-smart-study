// 텍스트 안의 ![alt](url) 이미지를 n8n에 요청해 설명 텍스트로 치환합니다.

const IMG_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

async function describeOne(url: string, alt: string): Promise<string> {
  try {
    const res = await fetch("/api/describe-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, alt }),
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = (await res.json()) as { description?: string };
    const desc = (data.description ?? "").trim();
    if (!desc) return alt ? `${alt}: 이미지 설명을 가져오지 못했습니다.` : "이미지 설명을 가져오지 못했습니다.";
    return alt ? `${alt}: ${desc}` : desc;
  } catch {
    return alt ? `${alt}: 이미지 설명을 가져오지 못했습니다.` : "이미지 설명을 가져오지 못했습니다.";
  }
}

export function hasImageMarkdown(text: string): boolean {
  return /!\[[^\]]*\]\([^)]+\)/.test(text);
}

export async function expandImagesForSpeech(text: string): Promise<string> {
  if (!text || !hasImageMarkdown(text)) return text;
  const matches = [...text.matchAll(IMG_RE)];
  const descriptions = await Promise.all(
    matches.map((m) => describeOne(m[2].trim(), (m[1] ?? "").trim())),
  );
  let i = 0;
  return text.replace(IMG_RE, () => ` ${descriptions[i++]} `);
}
