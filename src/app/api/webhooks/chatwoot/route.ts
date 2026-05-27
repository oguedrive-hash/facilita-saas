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

  after(() => processLead(msg));

  return NextResponse.json({ received: true, decision: "queued" });
}

async function processLead(msg: ChatwootWebhookMessageCreated) {
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

  console.log("[caio:tenant]", "org:", org.name, org.id);

  const phone = msg.sender?.phone_number;
  const name = msg.sender?.name;

  if (!phone) {
    console.warn("[caio:lead]", "sem phone_number do sender");
    return;
  }

  const supabase = createAdminClient();

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
        nome: name,
        chatwoot_conversation_id: msg.conversation?.id,
      })
      .eq("id", existing.id);
    console.log(
      "[caio:lead]",
      "atualizado:",
      existing.id,
      `(${Date.now() - startedAt}ms)`,
    );
    return;
  }

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
    return;
  }
  console.log(
    "[caio:lead]",
    "criado:",
    novo.id,
    `(${Date.now() - startedAt}ms)`,
  );
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
