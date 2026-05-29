import { createFileRoute } from "@tanstack/react-router";

// n8n 이미지 설명 webhook (Solar LLM 호출)
const N8N_IMAGE_WEBHOOK_URL =
  process.env.N8N_IMAGE_WEBHOOK_URL ??
  "https://hp432300.app.n8n.cloud/webhook/docvoice/describe-image";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/describe-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: { url?: string; alt?: string };
        try {
          payload = (await request.json()) as { url?: string; alt?: string };
        } catch {
          return jsonResponse({ error: "잘못된 요청" }, 400);
        }
        const url = typeof payload.url === "string" ? payload.url.trim() : "";
        if (!url) return jsonResponse({ error: "url이 필요합니다." }, 400);
        const alt = typeof payload.alt === "string" ? payload.alt : "";

        let response: Response;
        try {
          response = await fetch(N8N_IMAGE_WEBHOOK_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
            },
            body: JSON.stringify({ image_url: url, alt }),
          });
        } catch (error) {
          return jsonResponse(
            {
              error: "이미지 설명 서버에 연결하지 못했습니다.",
              details: error instanceof Error ? error.message : "네트워크 오류",
            },
            502,
          );
        }

        const text = await response.text();
        if (!response.ok) {
          return jsonResponse(
            { error: `이미지 설명 요청 실패 (${response.status})`, details: text },
            response.status,
          );
        }

        // n8n 응답에서 설명 텍스트 추출
        let description = "";
        try {
          const data = text ? JSON.parse(text) : {};
          const root = Array.isArray(data) ? data[0] ?? {} : data;
          const candidate =
            root.description ?? root.text ?? root.summary_text ?? root.direct_text ?? root.result;
          description = typeof candidate === "string" ? candidate : "";
        } catch {
          description = text;
        }

        return jsonResponse({ description });
      },
    },
  },
});
