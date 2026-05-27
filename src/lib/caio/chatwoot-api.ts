/**
 * Cliente da API HTTP do Chatwoot.
 *
 * Server-side only. Usa o token da env var CHATWOOT_API_TOKEN.
 *
 * Todas as funções fazem try/catch internamente e retornam ou
 * `{ error: string }` ou um default safe — assim falhas de rede
 * (DNS, timeout, Chatwoot offline) não derrubam páginas inteiras.
 */

function config() {
  const rawUrl = process.env.CHATWOOT_URL;
  const accountId = process.env.CHATWOOT_ACCOUNT_ID;
  const token = process.env.CHATWOOT_API_TOKEN;

  if (!rawUrl) throw new Error("CHATWOOT_URL não está definida");
  if (!accountId) throw new Error("CHATWOOT_ACCOUNT_ID não está definida");
  if (!token) throw new Error("CHATWOOT_API_TOKEN não está definida");

  // Remove barra final pra evitar // no path (causa 404)
  const url = rawUrl.replace(/\/+$/, "");

  return {
    url,
    accountId,
    token,
    baseUrl: `${url}/api/v1/accounts/${accountId}`,
  };
}

async function safeFetch(
  url: string,
  init?: RequestInit,
): Promise<Response | { error: string }> {
  try {
    const res = await fetch(url, init);
    return res;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Falha de rede: ${msg}` };
  }
}

/**
 * Envia uma mensagem outgoing numa conversa.
 */
export async function enviarMensagem(opts: {
  conversationId: number;
  content: string;
}): Promise<{ id: number; content: string } | { error: string }> {
  let baseUrl: string;
  let token: string;
  try {
    ({ baseUrl, token } = config());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "config inválida" };
  }

  const result = await safeFetch(
    `${baseUrl}/conversations/${opts.conversationId}/messages`,
    {
      method: "POST",
      headers: {
        api_access_token: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        content: opts.content,
        message_type: "outgoing",
        private: false,
      }),
    },
  );
  if ("error" in result) return result;
  if (!result.ok) {
    const text = await result.text();
    return {
      error: `Chatwoot respondeu ${result.status}: ${text.slice(0, 300)}`,
    };
  }
  try {
    const data = (await result.json()) as { id: number; content: string };
    return { id: data.id, content: data.content };
  } catch {
    return { error: "Resposta do Chatwoot não é JSON válido" };
  }
}

/**
 * Envia uma mensagem outgoing COM áudio anexado.
 * Usa multipart/form-data porque tem arquivo.
 */
export async function enviarMensagemComAudio(opts: {
  conversationId: number;
  audio: ArrayBuffer;
  filename?: string;
  mimeType?: string;
  content?: string;
}): Promise<{ id: number } | { error: string }> {
  let baseUrl: string;
  let token: string;
  try {
    ({ baseUrl, token } = config());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "config inválida" };
  }

  const form = new FormData();
  form.set("message_type", "outgoing");
  form.set("private", "false");
  if (opts.content) form.set("content", opts.content);
  const blob = new Blob([opts.audio], {
    type: opts.mimeType ?? "audio/mpeg",
  });
  const file = new File([blob], opts.filename ?? "audio.mp3", {
    type: opts.mimeType ?? "audio/mpeg",
  });
  form.append("attachments[]", file);

  // Timeout de 30s — se Evolution/WhatsApp estiver lento, melhor falhar
  // logo e cair pro fallback texto do que travar 60s+ esperando.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const res = await fetch(
      `${baseUrl}/conversations/${opts.conversationId}/messages`,
      {
        method: "POST",
        headers: { api_access_token: token },
        body: form,
        signal: controller.signal,
      },
    );
    clearTimeout(timeoutId);
    if (!res.ok) {
      const text = await res.text();
      return {
        error: `Chatwoot ${res.status}: ${text.slice(0, 300)}`,
      };
    }
    const data = (await res.json()) as { id: number };
    return { id: data.id };
  } catch (err) {
    clearTimeout(timeoutId);
    if (err instanceof Error && err.name === "AbortError") {
      return { error: "Chatwoot timeout (30s) — Evolution provavelmente está lento ou offline" };
    }
    return {
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}

/**
 * Aplica (substitui) etiquetas numa conversa.
 */
export async function setLabels(opts: {
  conversationId: number;
  labels: string[];
}): Promise<{ ok: true } | { error: string }> {
  let baseUrl: string;
  let token: string;
  try {
    ({ baseUrl, token } = config());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "config inválida" };
  }

  const result = await safeFetch(
    `${baseUrl}/conversations/${opts.conversationId}/labels`,
    {
      method: "POST",
      headers: {
        api_access_token: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ labels: opts.labels }),
    },
  );
  if ("error" in result) return result;
  if (!result.ok) {
    const text = await result.text();
    return {
      error: `Chatwoot respondeu ${result.status}: ${text.slice(0, 300)}`,
    };
  }
  return { ok: true };
}

/**
 * Busca as labels atuais de uma conversa. Em caso de falha retorna [].
 */
export async function getLabels(opts: {
  conversationId: number;
}): Promise<string[]> {
  let baseUrl: string;
  let token: string;
  try {
    ({ baseUrl, token } = config());
  } catch {
    return [];
  }

  const result = await safeFetch(
    `${baseUrl}/conversations/${opts.conversationId}/labels`,
    { headers: { api_access_token: token } },
  );
  if ("error" in result) return [];
  if (!result.ok) return [];
  try {
    const data = (await result.json()) as { payload?: string[] };
    return data.payload ?? [];
  } catch {
    return [];
  }
}

/**
 * Adiciona uma label específica sem remover as outras.
 */
export async function addLabel(opts: {
  conversationId: number;
  label: string;
}): Promise<{ ok: true } | { error: string }> {
  const current = await getLabels({ conversationId: opts.conversationId });
  if (current.includes(opts.label)) return { ok: true };
  return setLabels({
    conversationId: opts.conversationId,
    labels: [...current, opts.label],
  });
}

/**
 * Muda status de uma conversa (resolved, open, pending).
 */
export async function toggleConversationStatus(opts: {
  conversationId: number;
  status: "open" | "resolved" | "pending";
}): Promise<{ ok: true } | { error: string }> {
  let baseUrl: string;
  let token: string;
  try {
    ({ baseUrl, token } = config());
  } catch (e) {
    return { error: e instanceof Error ? e.message : "config inválida" };
  }

  const result = await safeFetch(
    `${baseUrl}/conversations/${opts.conversationId}/toggle_status`,
    {
      method: "POST",
      headers: {
        api_access_token: token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: opts.status }),
    },
  );
  if ("error" in result) return result;
  if (!result.ok) {
    const text = await result.text();
    return {
      error: `Chatwoot respondeu ${result.status}: ${text.slice(0, 300)}`,
    };
  }
  return { ok: true };
}
