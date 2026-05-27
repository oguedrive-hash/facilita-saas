import { NextResponse, after, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { filterWebhook } from "@/lib/caio/filter";
import {
  resolveOrganization,
  getFacilitaOrgFallback,
} from "@/lib/caio/tenant";
import {
  normalizeMessageType,
  type ChatwootWebhook,
  type ChatwootWebhookMessageCreated,
  type ChatwootWebhookConversationUpdated,
  type ChatwootMessage,
  type ChatwootSender,
} from "@/lib/caio/types";

// Chatwoot 4.11 + WhatsApp/Evolution dispara principalmente
// `conversation_updated` (com `messages[]` aninhado), não message_created
// separado. Por isso o handler suporta ambos os formatos e dedupa pelo
// unique constraint em `chatwoot_message_id`.

export async function POST(request: NextRequest) {
  let webhook: ChatwootWebhook;
  try {
    webhook = (await request.json()) as ChatwootWebhook;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  console.log("[caio:webhook]", {
    event: webhook.event,
    ts: new Date().toISOString(),
  });

  const decision = filterWebhook(webhook, []);
  if (decision.action === "ignore") {
    console.log("[caio:filter]", "ignore:", decision.reason);
    return NextResponse.json({
      received: true,
      decision: "ignore",
      reason: decision.reason,
    });
  }

  after(() => processWebhook(webhook));
  return NextResponse.json({ received: true, decision: "queued" });
}

async function processWebhook(webhook: ChatwootWebhook) {
  const startedAt = Date.now();

  let org = await resolveOrganization(webhook);
  if (!org) org = await getFacilitaOrgFallback();
  if (!org) {
    console.warn("[caio:tenant]", "nenhuma org encontrada");
    return;
  }

  const mensagens = extrairMensagens(webhook);
  if (mensagens.length === 0) {
    console.log("[caio:webhook]", "nenhuma mensagem no payload");
    return;
  }

  const supabase = createAdminClient();
  let processadas = 0;

  for (const item of mensagens) {
    const ok = await processarMensagem(supabase, org.id, item);
    if (ok) processadas++;
  }

  console.log(
    "[caio:webhook]",
    "processadas",
    processadas,
    "/",
    mensagens.length,
    `(${Date.now() - startedAt}ms)`,
  );
}

type MensagemNormalizada = {
  chatwoot_message_id: number;
  conversation_id: number | undefined;
  content: string | null;
  message_type: "incoming" | "outgoing";
  sender: ChatwootSender | undefined;
  attachments:
    | NonNullable<ChatwootWebhookMessageCreated["attachments"]>
    | undefined;
  private: boolean;
};

/**
 * Extrai mensagens do payload, normalizando ambos os formatos:
 * - message_created/updated: a mensagem está no body raiz
 * - conversation_*: a mensagem está dentro de `messages[]`
 */
function extrairMensagens(webhook: ChatwootWebhook): MensagemNormalizada[] {
  if (
    webhook.event === "message_created" ||
    webhook.event === "message_updated"
  ) {
    const m = webhook as ChatwootWebhookMessageCreated;
    return [
      {
        chatwoot_message_id: m.id,
        conversation_id: m.conversation?.id,
        content: m.content,
        message_type: normalizeMessageType(m.message_type),
        sender: m.sender,
        attachments: m.attachments,
        private: m.private ?? false,
      },
    ];
  }

  if (
    webhook.event === "conversation_created" ||
    webhook.event === "conversation_updated"
  ) {
    const conv = webhook as ChatwootWebhookConversationUpdated;
    const msgs = conv.messages ?? [];
    return msgs.map((m: ChatwootMessage) => ({
      chatwoot_message_id: m.id,
      conversation_id: m.conversation_id ?? conv.id,
      content: m.content,
      message_type: normalizeMessageType(m.message_type),
      sender: m.sender ?? conv.meta?.sender,
      attachments: m.attachments,
      private: m.private ?? false,
    }));
  }

  return [];
}

async function processarMensagem(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  msg: MensagemNormalizada,
): Promise<boolean> {
  if (msg.private) return false;
  if (!msg.conversation_id) {
    console.log("[caio:msg]", "sem conversation_id, ignorando");
    return false;
  }

  let leadId: string | null = null;

  if (msg.message_type === "incoming") {
    const phone = msg.sender?.phone_number;
    if (!phone) {
      console.warn("[caio:msg]", "incoming sem phone_number do sender");
      return false;
    }

    const { data: existing } = await supabase
      .from("leads")
      .select("id, status")
      .eq("organization_id", organizationId)
      .eq("telefone", phone)
      .maybeSingle();

    if (existing) {
      const newStatus =
        existing.status === "perdido" || existing.status === "novo_lead"
          ? "em_conversa"
          : existing.status;
      await supabase
        .from("leads")
        .update({
          status: newStatus,
          nome: msg.sender?.name,
          chatwoot_conversation_id: msg.conversation_id,
        })
        .eq("id", existing.id);
      leadId = existing.id;
    } else {
      const { data: novo, error } = await supabase
        .from("leads")
        .insert({
          organization_id: organizationId,
          telefone: phone,
          nome: msg.sender?.name,
          status: "em_conversa",
          source: "whatsapp",
          chatwoot_conversation_id: msg.conversation_id,
        })
        .select("id")
        .single();

      if (error || !novo) {
        console.error("[caio:lead]", "erro ao inserir:", error);
        return false;
      }
      leadId = novo.id;
    }
  } else {
    // outgoing: busca lead pela conversation_id
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("chatwoot_conversation_id", msg.conversation_id)
      .maybeSingle();

    if (!lead) {
      console.log(
        "[caio:msg]",
        "outgoing sem lead correspondente (conv_id=",
        msg.conversation_id,
        ")",
      );
      return false;
    }
    leadId = lead.id;
  }

  if (!leadId) return false;

  return await gravarMensagem(supabase, organizationId, leadId, msg);
}

async function gravarMensagem(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  leadId: string,
  msg: MensagemNormalizada,
): Promise<boolean> {
  const direcao = msg.message_type === "incoming" ? "entrada" : "saida";
  const tipo = inferirTipo(msg.attachments);
  const attachmentUrl = msg.attachments?.[0]?.data_url ?? null;

  const { error } = await supabase.from("mensagens").insert({
    organization_id: organizationId,
    lead_id: leadId,
    chatwoot_message_id: msg.chatwoot_message_id,
    chatwoot_conversation_id: msg.conversation_id,
    conteudo: msg.content,
    tipo,
    attachment_url: attachmentUrl,
    direcao,
    remetente_nome: msg.sender?.name,
    privada: msg.private,
  });

  if (error) {
    // unique violation no chatwoot_message_id — webhook entregue 2x ou
    // mensagem já gravada (acontece com conversation_updated repetido)
    if (error.code === "23505") return false;
    console.error("[caio:msg]", "erro ao gravar:", error);
    return false;
  }

  return true;
}

function inferirTipo(
  attachments: MensagemNormalizada["attachments"],
): "texto" | "audio" | "imagem" | "video" | "arquivo" {
  const att = attachments?.[0];
  if (!att) return "texto";
  switch (att.file_type) {
    case "audio":
      return "audio";
    case "image":
      return "imagem";
    case "video":
      return "video";
    default:
      return "arquivo";
  }
}

export async function GET() {
  return NextResponse.json({
    name: "Caio webhook handler",
    mode: "shadow",
    description:
      "Recebe eventos do Chatwoot (message_* e conversation_*), grava lead e mensagens no Supabase.",
    accepts: "POST application/json",
  });
}
