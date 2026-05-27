import { NextResponse, after, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { filterWebhook } from "@/lib/caio/filter";
import {
  resolveOrganization,
  getFacilitaOrgFallback,
} from "@/lib/caio/tenant";
import type {
  ChatwootWebhook,
  ChatwootWebhookMessageCreated,
} from "@/lib/caio/types";

// Chatwoot 4.11 tem timeout fixo de 5s pra webhook delivery. Pra evitar
// timeout em cold start da função (que descarta o evento), respondemos
// 200 imediato e processamos o lead em background com `after()`.

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

  const msg = webhook as ChatwootWebhookMessageCreated;
  after(() => processMessage(msg));
  return NextResponse.json({ received: true, decision: "queued" });
}

async function processMessage(msg: ChatwootWebhookMessageCreated) {
  const startedAt = Date.now();

  let org = await resolveOrganization(msg);
  if (!org) {
    org = await getFacilitaOrgFallback();
  }
  if (!org) {
    console.warn(
      "[caio:tenant]",
      "Nenhuma organização identificada para inbox_id=",
      msg.conversation?.inbox_id,
    );
    return;
  }

  const supabase = createAdminClient();

  // Pega o lead correspondente. Em incoming, cria/atualiza pelo telefone.
  // Em outgoing, só busca pela conversation_id (não cria lead a partir de mensagem do bot).
  let leadId: string | null = null;

  if (msg.message_type === "incoming") {
    const phone = msg.sender?.phone_number;
    if (!phone) {
      console.warn("[caio:lead]", "incoming sem phone_number");
      return;
    }

    const { data: existing } = await supabase
      .from("leads")
      .select("id, status")
      .eq("organization_id", org.id)
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
          chatwoot_conversation_id: msg.conversation?.id,
        })
        .eq("id", existing.id);
      leadId = existing.id;
    } else {
      const { data: novo, error } = await supabase
        .from("leads")
        .insert({
          organization_id: org.id,
          telefone: phone,
          nome: msg.sender?.name,
          status: "em_conversa",
          source: "whatsapp",
          chatwoot_conversation_id: msg.conversation?.id,
        })
        .select("id")
        .single();

      if (error || !novo) {
        console.error("[caio:lead]", "erro ao inserir:", error);
        return;
      }
      leadId = novo.id;
    }
  } else {
    // outgoing: precisa achar lead pela conversation_id
    const convId = msg.conversation?.id;
    if (!convId) {
      console.log("[caio:msg]", "outgoing sem conversation_id");
      return;
    }
    const { data: lead } = await supabase
      .from("leads")
      .select("id")
      .eq("organization_id", org.id)
      .eq("chatwoot_conversation_id", convId)
      .maybeSingle();

    if (!lead) {
      console.log(
        "[caio:msg]",
        "outgoing sem lead correspondente (conv_id=",
        convId,
        ")",
      );
      return;
    }
    leadId = lead.id;
  }

  if (!leadId) return;

  await gravarMensagem(supabase, org.id, leadId, msg);
  console.log(
    "[caio:msg]",
    msg.message_type,
    "processado em",
    `${Date.now() - startedAt}ms`,
  );
}

async function gravarMensagem(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  leadId: string,
  msg: ChatwootWebhookMessageCreated,
) {
  const direcao = msg.message_type === "incoming" ? "entrada" : "saida";
  const tipo = inferirTipo(msg);
  const attachmentUrl = msg.attachments?.[0]?.data_url ?? null;

  const { error } = await supabase.from("mensagens").insert({
    organization_id: organizationId,
    lead_id: leadId,
    chatwoot_message_id: msg.id,
    chatwoot_conversation_id: msg.conversation?.id,
    conteudo: msg.content,
    tipo,
    attachment_url: attachmentUrl,
    direcao,
    remetente_nome: msg.sender?.name,
    privada: msg.private ?? false,
  });

  if (error) {
    if (error.code === "23505") {
      // unique violation no chatwoot_message_id — dedup, webhook entregue 2x
      return;
    }
    console.error("[caio:msg]", "erro ao gravar:", error);
  }
}

function inferirTipo(
  msg: ChatwootWebhookMessageCreated,
): "texto" | "audio" | "imagem" | "video" | "arquivo" {
  const att = msg.attachments?.[0];
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
      "Recebe eventos do Chatwoot, grava lead e mensagens no Supabase. n8n continua respondendo.",
    accepts: "POST application/json",
  });
}
