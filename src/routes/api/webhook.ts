import { createFileRoute } from "@tanstack/react-router";

const N8N_WEBHOOK_URL =
  "https://hp432300.app.n8n.cloud/webhook/docvoice/upload";

type WebhookMode = "summary" | "read_all" | "qa" | "all";

type WebhookPayload = {
  file_base64: string;
  mode: WebhookMode;
  user_question: string;
  history: unknown[];
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parsePayload(input: unknown): WebhookPayload {
  if (!input || typeof input !== "object") {
    throw new Error("요청 형식이 올바르지 않습니다.");
  }
  const p = input as Partial<WebhookPayload>;
  if (!p.file_base64 || typeof p.file_base64 !== "string") {
    throw new Error("PDF 파일 데이터가 없습니다.");
  }
  if (
    p.mode !== "summary" &&
    p.mode !== "read_all" &&
    p.mode !== "qa" &&
    p.mode !== "all"
  ) {
    throw new Error("mode 값이 올바르지 않습니다.");
  }
  return {
    file_base64: p.file_base64,
    mode: p.mode,
    user_question: typeof p.user_question === "string" ? p.user_question : "",
    history: Array.isArray(p.history) ? p.history : [],
  };
}

function extractWebhookError(text: string, status: number) {
  try {
    const data = text ? JSON.parse(text) : null;
    const message =
      data && typeof data === "object" && typeof (data as { message?: unknown }).message === "string"
        ? (data as { message: string }).message
        : undefined;
    if (status === 404 && message?.includes("not registered")) {
      return {
        error: "n8n 웹훅이 아직 활성화되지 않았습니다.",
        details: "n8n 워크플로우를 활성화해 주세요.",
      };
    }
    if (message) return { error: `n8n 요청 실패 (${status})`, details: message };
  } catch {
    if (text) return { error: `n8n 요청 실패 (${status})`, details: text };
  }
  return { error: `n8n 요청 실패 (${status})` };
}

export const Route = createFileRoute("/api/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: WebhookPayload;
        try {
          payload = parsePayload(await request.json());
        } catch (error) {
          return jsonResponse(
            { error: error instanceof Error ? error.message : "잘못된 요청" },
            400,
          );
        }

        let response: Response;
        try {
          response = await fetch(N8N_WEBHOOK_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json, text/plain;q=0.9, */*;q=0.8",
            },
            body: JSON.stringify(payload),
          });
        } catch (error) {
          return jsonResponse(
            {
              error: "n8n 서버에 연결하지 못했습니다.",
              details: error instanceof Error ? error.message : "네트워크 오류",
            },
            502,
          );
        }

        const text = await response.text();
        if (!response.ok) {
          return jsonResponse(extractWebhookError(text, response.status), response.status);
        }

        // n8n 응답을 그대로 전달 (배열이면 첫 항목)
        try {
          const data = text ? JSON.parse(text) : {};
          const body = Array.isArray(data) ? data[0] ?? {} : data;
          return jsonResponse(body);
        } catch {
          return jsonResponse({ summary_text: text });
        }
      },
    },
  },
});
