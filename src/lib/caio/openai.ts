/**
 * Cliente OpenAI minimalista via fetch direto.
 * Sem dependência do SDK oficial — menos peso e mais controle.
 *
 * Server-side only (usa OPENAI_API_KEY do .env).
 */

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type ChatOptions = {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
};

export type ChatResult =
  | { content: string; usage?: { input: number; output: number } }
  | { error: string };

/**
 * Chama o endpoint /v1/chat/completions da OpenAI.
 * Retorna conteúdo da primeira choice ou { error }.
 */
export async function chatCompletion(opts: ChatOptions): Promise<ChatResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { error: "OPENAI_API_KEY não definida" };

  const model = opts.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        temperature: opts.temperature ?? 0.7,
        ...(opts.max_tokens ? { max_tokens: opts.max_tokens } : {}),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        error: `OpenAI ${res.status}: ${text.slice(0, 300)}`,
      };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { error: "Resposta OpenAI sem content" };

    return {
      content,
      usage: data.usage
        ? { input: data.usage.prompt_tokens, output: data.usage.completion_tokens }
        : undefined,
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}
