import { NextResponse, after, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { filterWebhook } from "@/lib/caio/filter";
import {
  resolveOrganization,
  getFacilitaOrgFallback,
} from "@/lib/caio/tenant";
import { gerarRespostaCaio } from "@/lib/caio/gerar-resposta";
import { transcreverAudio } from "@/lib/caio/openai";
import { gerarAudio } from "@/lib/caio/elevenlabs";
import {
  enviarMensagem,
  enviarMensagemComAudio,
} from "@/lib/caio/chatwoot-api";
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

  const supabase = createAdminClient();

  // Sincroniza estado do Caio (caio_ativo) com a etiqueta `agente-off`
  // do Chatwoot — vem nos eventos conversation_*
  await sincronizarCaioAtivo(supabase, org.id, webhook);

  const mensagens = extrairMensagens(webhook);
  if (mensagens.length === 0) {
    console.log("[caio:webhook]", "nenhuma mensagem no payload");
    return;
  }

  let processadas = 0;
  // Coleta leadIds que receberam mensagem incoming nova — depois geramos
  // shadow pra eles (1x por lead, mesmo se receberam várias msgs juntas).
  const leadsComIncomingNova = new Set<string>();

  for (const item of mensagens) {
    const res = await processarMensagem(supabase, org.id, item);
    if (res.ok) {
      processadas++;
      if (res.leadId && item.message_type === "incoming") {
        leadsComIncomingNova.add(res.leadId);
      }
    }
  }

  console.log(
    "[caio:webhook]",
    "processadas",
    processadas,
    "/",
    mensagens.length,
    `(${Date.now() - startedAt}ms)`,
  );

  // Lead respondeu — zera o ciclo de follow-up e atualiza ultima_msg_lead_em.
  // (Roda em paralelo com a geracao da resposta pra nao atrasar.)
  if (leadsComIncomingNova.size > 0) {
    await supabase
      .from("leads")
      .update({
        numero_followup: 0,
        proximo_followup_em: null,
        ultima_msg_lead_em: new Date().toISOString(),
      })
      .in("id", Array.from(leadsComIncomingNova));
  }

  // Pra cada lead com incoming nova: agenda resposta com debounce. Se chegar
  // outra msg desse lead dentro do debounce, o ciclo antigo desiste e o novo
  // assume — Caio so responde quando o lead realmente parou de digitar.
  for (const leadId of leadsComIncomingNova) {
    await agendarRespostaCaioComDebounce(supabase, org.id, leadId);
  }
}

/**
 * Agenda resposta do Caio com debounce: se chegar outra msg do mesmo lead
 * antes do timer estourar, esse ciclo desiste e o novo assume. Caio so
 * responde quando o lead parou de mandar mensagens por DEBOUNCE segundos.
 */
async function agendarRespostaCaioComDebounce(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  leadId: string,
) {
  // Le tempo de debounce da org (default 6s se nao configurado)
  const { data: org } = await supabase
    .from("organizations")
    .select("caio_debounce_segundos")
    .eq("id", organizationId)
    .single();
  const debounceMs = (org?.caio_debounce_segundos ?? 6) * 1000;

  // Marca o "previsto para" — esse timestamp e o ID desse ciclo de debounce.
  // Se outra msg chegar e reescrever, esse ciclo perdeu e vai desistir.
  const meuPrevistoMs = Date.now() + debounceMs;
  const meuPrevistoIso = new Date(meuPrevistoMs).toISOString();
  await supabase
    .from("leads")
    .update({ caio_responder_em: meuPrevistoIso })
    .eq("id", leadId);

  // Aguarda o debounce
  await new Promise((r) => setTimeout(r, debounceMs));

  // Re-checa: ainda sou o vencedor? Compara como timestamp em ms (o formato
  // de string que volta do Postgres difere do que mandei — +00:00 vs Z).
  const { data: lead } = await supabase
    .from("leads")
    .select("caio_responder_em")
    .eq("id", leadId)
    .single();

  if (!lead?.caio_responder_em) {
    console.log("[caio:debounce] flag limpo, desistindo", leadId);
    return;
  }
  const atualMs = new Date(lead.caio_responder_em).getTime();
  if (atualMs !== meuPrevistoMs) {
    console.log("[caio:debounce] reagendado, desistindo", leadId);
    return;
  }

  // Sou o vencedor — processa e limpa o flag
  await responderLeadAuto(supabase, organizationId, leadId);
  await supabase
    .from("leads")
    .update({ caio_responder_em: null })
    .eq("id", leadId);
}

async function sincronizarCaioAtivo(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  webhook: ChatwootWebhook,
) {
  if (
    webhook.event !== "conversation_created" &&
    webhook.event !== "conversation_updated"
  ) {
    return;
  }
  const conv = webhook as ChatwootWebhookConversationUpdated;
  if (typeof conv.id !== "number") return;

  const labels = conv.labels ?? [];
  const caioAtivo = !labels.includes("agente-off");

  await supabase
    .from("leads")
    .update({ caio_ativo: caioAtivo })
    .eq("organization_id", organizationId)
    .eq("chatwoot_conversation_id", conv.id);
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

/**
 * Caio responde o lead automaticamente.
 *
 * 1. Verifica se Caio tá ativo (se humano assumiu via agente-off, não responde)
 * 2. Gera resposta texto via OpenAI
 * 3. Se a ÚLTIMA mensagem do lead foi áudio, converte resposta em áudio TTS
 *    (ElevenLabs) e envia como attachment de áudio
 * 4. Senão, envia como texto
 * 5. NÃO grava no banco aqui — webhook de conversation_updated vai voltar
 *    com a mensagem outgoing e o handler grava normal (dedup pelo
 *    chatwoot_message_id)
 */
async function responderLeadAuto(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  leadId: string,
) {
  const { data: lead } = await supabase
    .from("leads")
    .select("caio_ativo, chatwoot_conversation_id")
    .eq("id", leadId)
    .single();

  if (!lead || !lead.caio_ativo) return;
  if (!lead.chatwoot_conversation_id) {
    console.warn("[caio:auto]", "lead sem conversation_id:", leadId);
    return;
  }

  // Olha o tipo da última mensagem incoming pra decidir formato da resposta
  const { data: ultimaIncoming } = await supabase
    .from("mensagens")
    .select("tipo")
    .eq("lead_id", leadId)
    .eq("direcao", "entrada")
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  const responderComAudio = ultimaIncoming?.tipo === "audio";

  // Marca que Caio começou a processar — UI mostra "está digitando..."
  await supabase
    .from("leads")
    .update({ caio_processing_since: new Date().toISOString() })
    .eq("id", leadId);

  try {
    await gerarERespondeCaio(
      supabase,
      organizationId,
      leadId,
      lead.chatwoot_conversation_id,
      responderComAudio,
    );
    // Caio respondeu — agenda o primeiro follow-up baseado na config da org
    await agendarPrimeiroFollowup(supabase, organizationId, leadId);
  } finally {
    // Sempre limpa o flag, mesmo em erro — UI volta ao normal
    await supabase
      .from("leads")
      .update({ caio_processing_since: null })
      .eq("id", leadId);
  }
}

/**
 * Depois que Caio responde, agenda o 1º follow-up segundo a config da org.
 * Se a org nao tem followup_config ou nao tem regras ativas, nao agenda nada.
 */
async function agendarPrimeiroFollowup(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  leadId: string,
) {
  const { data: org } = await supabase
    .from("organizations")
    .select("followup_config")
    .eq("id", organizationId)
    .single();

  const config = org?.followup_config as
    | {
        regras?: {
          nivel: number;
          esperar_dias: number;
          esperar_horas: number;
          ativo: boolean;
        }[];
      }
    | null
    | undefined;
  const primeiraRegra = config?.regras?.find((r) => r.ativo && r.nivel === 1);
  if (!primeiraRegra) return;

  const proximoEm = new Date();
  proximoEm.setDate(proximoEm.getDate() + (primeiraRegra.esperar_dias ?? 0));
  proximoEm.setHours(proximoEm.getHours() + (primeiraRegra.esperar_horas ?? 0));

  await supabase
    .from("leads")
    .update({ proximo_followup_em: proximoEm.toISOString() })
    .eq("id", leadId);
}

async function gerarERespondeCaio(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  leadId: string,
  conversationId: number,
  responderComAudio: boolean,
) {
  // Gera resposta
  const result = await gerarRespostaCaio({ leadId });
  if ("error" in result) {
    console.error("[caio:auto]", "erro ao gerar:", result.error);
    return;
  }
  const texto = result.resposta;

  if (responderComAudio) {
    // Busca voice config da org pra esse lead
    const { data: org } = await supabase
      .from("organizations")
      .select("voice_id, voice_settings")
      .eq("id", organizationId)
      .single();

    // TTS via ElevenLabs + envia áudio no Chatwoot
    const tts = await gerarAudio({
      texto,
      voiceId: org?.voice_id ?? undefined,
      voiceSettings: org?.voice_settings ?? null,
    });
    if ("error" in tts) {
      console.warn(
        "[caio:auto]",
        "TTS falhou, caindo pra texto:",
        tts.error,
      );
      // Fallback: envia texto se TTS falhou
      const sent = await enviarMensagem({
        conversationId,
        content: texto,
      });
      if ("error" in sent) {
        console.error("[caio:auto]", "envio fallback falhou:", sent.error);
      }
      return;
    }

    const sent = await enviarMensagemComAudio({
      conversationId,
      audio: tts.audio,
      filename: "caio.mp3",
      mimeType: tts.mimeType,
    });
    if ("error" in sent) {
      console.error(
        "[caio:auto]",
        "envio áudio falhou, fallback texto:",
        sent.error,
      );
      // Fallback: se Chatwoot recusou áudio (timeout, formato, etc),
      // envia texto pra pelo menos o lead receber alguma resposta.
      const fallback = await enviarMensagem({
        conversationId,
        content: texto,
      });
      if ("error" in fallback) {
        console.error("[caio:auto]", "fallback texto falhou:", fallback.error);
      } else {
        console.log("[caio:auto]", "respondeu texto (fallback) pra lead", leadId);
      }
      return;
    }
    console.log("[caio:auto]", "respondeu áudio pra lead", leadId);
  } else {
    const sent = await enviarMensagem({
      conversationId,
      content: texto,
    });
    if ("error" in sent) {
      console.error("[caio:auto]", "envio texto falhou:", sent.error);
      return;
    }
    console.log("[caio:auto]", "respondeu texto pra lead", leadId);
  }
}

async function processarMensagem(
  supabase: ReturnType<typeof createAdminClient>,
  organizationId: string,
  msg: MensagemNormalizada,
): Promise<{ ok: boolean; leadId?: string }> {
  if (msg.private) return { ok: false };
  if (!msg.conversation_id) {
    console.log("[caio:msg]", "sem conversation_id, ignorando");
    return { ok: false };
  }

  let leadId: string | null = null;

  if (msg.message_type === "incoming") {
    const phone = msg.sender?.phone_number;
    if (!phone) {
      console.warn("[caio:msg]", "incoming sem phone_number do sender");
      return { ok: false };
    }
    if (!phoneValido(phone)) {
      console.warn(
        "[caio:msg]",
        "phone invalido (provavelmente teste do Evolution):",
        phone,
      );
      return { ok: false };
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
        return { ok: false };
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
      return { ok: false };
    }
    leadId = lead.id;
  }

  if (!leadId) return { ok: false };

  const gravou = await gravarMensagem(supabase, organizationId, leadId, msg);
  return { ok: gravou, leadId: gravou ? leadId : undefined };
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

  const { data, error } = await supabase
    .from("mensagens")
    .insert({
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
    })
    .select("id")
    .single();

  if (error) {
    // unique violation no chatwoot_message_id — webhook entregue 2x ou
    // mensagem já gravada (acontece com conversation_updated repetido)
    if (error.code === "23505") return false;
    console.error("[caio:msg]", "erro ao gravar:", error);
    return false;
  }

  // Áudio sem texto transcrito? Aguarda Whisper antes de retornar —
  // tudo isso roda em after() (background) então não atrasa o response
  // pro Chatwoot, mas shadow/sugestão IA precisam do texto pra funcionar.
  if (tipo === "audio" && attachmentUrl && !msg.content && data?.id) {
    await transcreverEAtualizar(supabase, data.id, attachmentUrl);
  }

  return true;
}

async function transcreverEAtualizar(
  supabase: ReturnType<typeof createAdminClient>,
  mensagemId: string,
  audioUrl: string,
) {
  const result = await transcreverAudio({ audioUrl });
  if ("error" in result) {
    console.warn("[caio:whisper]", "erro:", result.error);
    return;
  }
  await supabase
    .from("mensagens")
    .update({ conteudo: result.texto })
    .eq("id", mensagemId);
  console.log(
    "[caio:whisper]",
    "transcrita:",
    result.texto.slice(0, 60),
    mensagemId,
  );
}

/**
 * Aceita phones no formato E.164 com pelo menos 10 dígitos depois do +
 * (ex: +5511999998888). Bloqueia placeholders tipo "+123456" do Evolution.
 */
function phoneValido(phone: string): boolean {
  return /^\+\d{10,15}$/.test(phone);
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
