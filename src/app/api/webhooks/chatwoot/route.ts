import { NextResponse, type NextRequest } from "next/server";
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

/**
 * Webhook handler do Chatwoot.
 *
 * MODO SOMBRA (fase atual):
 * - Recebe webhook
 * - Identifica organização
 * - Aplica filtros (idêntico ao n8n)
 * - Grava lead no Supabase (multi-tenant)
 * - NÃO RESPONDE ao lead (n8n continua sendo quem responde)
 *
 * Pra ativar resposta: implementar process/route.ts (próxima fase).
 */

export async function POST(request: NextRequest) {
  const startedAt = Date.now();

  let webhook: ChatwootWebhook;
  try {
    webhook = (await request.json()) as ChatwootWebhook;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  // Log básico — todo evento que chega é registrado
  console.log("[caio:webhook]", {
    event: webhook.event,
    ts: new Date().toISOString(),
  });

  // Filtros iniciais (sem precisar consultar banco)
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

  // Identifica organização
  // TODO: usar resolveOrganization quando chatwoot_inbox_id estiver setado.
  // Por enquanto, fallback pra Facilita (única org real).
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
    return NextResponse.json({
      received: true,
      decision: "ignore",
      reason: "organização não identificada",
    });
  }

  console.log("[caio:tenant]", "org:", org.name, org.id);

  // Upsert do lead no Supabase
  const supabase = createAdminClient();

  const phone = msg.sender?.phone_number;
  const name = msg.sender?.name;

  if (!phone) {
    console.warn("[caio:lead]", "sem phone_number do sender");
    return NextResponse.json({
      received: true,
      decision: "ignore",
      reason: "sender sem phone_number",
    });
  }

  // Estratégia: tenta UPDATE primeiro. Se 0 linhas, faz INSERT.
  // (Supabase não tem UPSERT direto via SDK, mas o conflict pode ser tratado.)
  const { data: existing } = await supabase
    .from("leads")
    .select("id, status")
    .eq("organization_id", org.id)
    .eq("telefone", phone)
    .maybeSingle();

  let leadId: string;

  if (existing) {
    // Lead já existe — só atualiza updated_at e mantém status (a não ser que estava perdido)
    const newStatus =
      existing.status === "perdido" || existing.status === "novo_lead"
        ? "em_conversa"
        : existing.status;

    await supabase
      .from("leads")
      .update({
        status: newStatus,
        nome: name, // sempre atualiza nome (caso lead tenha mudado)
        chatwoot_conversation_id: msg.conversation?.id,
      })
      .eq("id", existing.id);
    leadId = existing.id;
    console.log("[caio:lead]", "atualizado:", leadId);
  } else {
    // Lead novo
    const { data: novo, error } = await supabase
      .from("leads")
      .insert({
        organization_id: org.id,
        telefone: phone,
        nome: name,
        status: "em_conversa",
        source: "whatsapp",
        chatwoot_conversation_id: msg.conversation?.id,
      })
      .select("id")
      .single();

    if (error || !novo) {
      console.error("[caio:lead]", "erro ao inserir:", error);
      return NextResponse.json({
        received: true,
        decision: "error",
        reason: error?.message,
      });
    }
    leadId = novo.id;
    console.log("[caio:lead]", "criado:", leadId);
  }

  const durationMs = Date.now() - startedAt;
  console.log("[caio:webhook]", "done in", durationMs, "ms");

  return NextResponse.json({
    received: true,
    decision: "shadow_log",
    lead_id: leadId,
    org_id: org.id,
    org_name: org.name,
    duration_ms: durationMs,
  });
}

export async function GET() {
  return NextResponse.json({
    name: "Caio webhook handler",
    mode: "shadow",
    description:
      "Recebe eventos do Chatwoot, grava lead no Supabase. n8n continua respondendo.",
    accepts: "POST application/json",
  });
}
