/**
 * Cliente da API HTTP do Chatwoot.
 *
 * Server-side only. Usa o token da env var CHATWOOT_API_TOKEN.
 *
 * Docs: https://www.chatwoot.com/developers/api/
 */

function config() {
  const url = process.env.CHATWOOT_URL;
  const accountId = process.env.CHATWOOT_ACCOUNT_ID;
  const token = process.env.CHATWOOT_API_TOKEN;

  if (!url) throw new Error("CHATWOOT_URL não está definida");
  if (!accountId) throw new Error("CHATWOOT_ACCOUNT_ID não está definida");
  if (!token) throw new Error("CHATWOOT_API_TOKEN não está definida");

  return {
    url,
    accountId,
    token,
    baseUrl: `${url}/api/v1/accounts/${accountId}`,
  };
}

/**
 * Envia uma mensagem outgoing numa conversa.
 * Chatwoot dispara webhook conversation_updated; nosso handler grava no
 * Supabase via dedup pelo chatwoot_message_id. Mas pra dar feedback
 * imediato na UI a gente também grava aqui mesmo.
 */
export async function enviarMensagem(opts: {
  conversationId: number;
  content: string;
}): Promise<{ id: number; content: string } | { error: string }> {
  const { baseUrl, token } = config();
  const res = await fetch(
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

  if (!res.ok) {
    const text = await res.text();
    return {
      error: `Chatwoot respondeu ${res.status}: ${text.slice(0, 300)}`,
    };
  }

  const data = (await res.json()) as { id: number; content: string };
  return { id: data.id, content: data.content };
}

/**
 * Aplica (e/ou substitui) etiquetas numa conversa.
 * O Chatwoot SUBSTITUI a lista, então sempre passa a lista completa.
 */
export async function setLabels(opts: {
  conversationId: number;
  labels: string[];
}): Promise<{ ok: true } | { error: string }> {
  const { baseUrl, token } = config();
  const res = await fetch(
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

  if (!res.ok) {
    const text = await res.text();
    return {
      error: `Chatwoot respondeu ${res.status}: ${text.slice(0, 300)}`,
    };
  }

  return { ok: true };
}

/**
 * Busca as labels atuais de uma conversa.
 */
export async function getLabels(opts: {
  conversationId: number;
}): Promise<string[]> {
  const { baseUrl, token } = config();
  const res = await fetch(
    `${baseUrl}/conversations/${opts.conversationId}/labels`,
    {
      headers: { api_access_token: token },
    },
  );

  if (!res.ok) return [];
  const data = (await res.json()) as { payload?: string[] };
  return data.payload ?? [];
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
 * Muda status de uma conversa.
 * "resolved" fecha a conversa, "open" reabre.
 */
export async function toggleConversationStatus(opts: {
  conversationId: number;
  status: "open" | "resolved" | "pending";
}): Promise<{ ok: true } | { error: string }> {
  const { baseUrl, token } = config();
  const res = await fetch(
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

  if (!res.ok) {
    const text = await res.text();
    return {
      error: `Chatwoot respondeu ${res.status}: ${text.slice(0, 300)}`,
    };
  }
  return { ok: true };
}
