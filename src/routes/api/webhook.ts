import { createFileRoute } from "@tanstack/react-router";

const N8N_WEBHOOK_URL =
  "https://hp432300.app.n8n.cloud/webhook/docvoice/upload";

type WebhookMode = "요약" | "질문";

type WebhookPayload = {
  file: string;
  question: string;
  mode: WebhookMode;
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function parsePayload(input: unknown): WebhookPayload {
  if (!input || typeof input !== "object") {
    throw new Error("요청 형식이 올바르지 않습니다.");
  }

  const payload = input as Partial<WebhookPayload>;

  if (!payload.file || typeof payload.file !== "string") {
    throw new Error("PDF 파일 데이터가 없습니다.");
  }

  if (typeof payload.question !== "string") {
    throw new Error("question 값이 올바르지 않습니다.");
  }

  if (payload.mode !== "요약" && payload.mode !== "질문") {
    throw new Error("mode 값이 올바르지 않습니다.");
  }

  return {
    file: payload.file,
    question: payload.question,
    mode: payload.mode,
  };
}

function extractAnswer(text: string): string {
  try {
    const data = text ? JSON.parse(text) : null;
    if (Array.isArray(data) && typeof data[0]?.answer === "string") {
      return data[0].answer;
    }
    if (data && typeof data === "object" && typeof data.answer === "string") {
      return data.answer;
    }
  } catch {
    return text;
  }

  return text;
}

function extractWebhookError(text: string, status: number): {
  error: string;
  details?: string;
} {
  try {
    const data = text ? JSON.parse(text) : null;
    const message =
      data && typeof data === "object" && typeof data.message === "string"
        ? data.message
        : undefined;
    const hint =
      data && typeof data === "object" && typeof data.hint === "string"
        ? data.hint
        : undefined;

    if (status === 404 && message?.includes("not registered")) {
      return {
        error: "n8n 웹훅이 아직 활성화되지 않았습니다.",
        details: "n8n 워크플로우를 활성화하거나 올바른 webhook 경로인지 확인해 주세요.",
      };
    }

    if (message) {
      return {
        error: `n8n 요청 실패 (${status})`,
        details: hint ? `${message} / ${hint}` : message,
      };
    }
  } catch {
    if (text) {
      return {
        error: `n8n 요청 실패 (${status})`,
        details: text,
      };
    }
  }

  return {
    error: `n8n 요청 실패 (${status})`,
  };
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
            {
              error:
                error instanceof Error
                  ? error.message
                  : "잘못된 요청입니다.",
            },
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
              details:
                error instanceof Error ? error.message : "네트워크 오류가 발생했습니다.",
            },
            502,
          );
        }

        const text = await response.text();

        if (!response.ok) {
          return jsonResponse(extractWebhookError(text, response.status), response.status);
        }

        return jsonResponse({ answer: extractAnswer(text) });
      },
    },
  },
});