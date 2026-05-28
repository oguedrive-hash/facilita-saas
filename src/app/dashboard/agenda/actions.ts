"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

const STATUS_VALIDOS = ["agendado", "realizado", "no_show", "cancelado"];

export async function mudarStatusAgendamento(
  formData: FormData,
): Promise<{ ok: true } | { error: string }> {
  const agendamentoId = formData.get("agendamentoId");
  const novoStatus = formData.get("status");
  if (typeof agendamentoId !== "string" || !agendamentoId) {
    return { error: "agendamentoId ausente" };
  }
  if (typeof novoStatus !== "string" || !STATUS_VALIDOS.includes(novoStatus)) {
    return { error: "status inválido" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("agendamentos")
    .update({ status: novoStatus })
    .eq("id", agendamentoId);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/agenda");
  return { ok: true };
}

export async function setAgendaView(view: "lista" | "calendario") {
  const c = await cookies();
  c.set("agenda_view_preferida", view, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  revalidatePath("/dashboard/agenda");
}
