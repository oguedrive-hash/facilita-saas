"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function validarAdmin(): Promise<
  { ok: true } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return { error: "Apenas admin" };
  return { ok: true };
}

export async function pausarReativarCliente(formData: FormData): Promise<
  { ok: true } | { error: string }
> {
  const auth = await validarAdmin();
  if ("error" in auth) return auth;

  const clienteId = formData.get("clienteId");
  const ativo = formData.get("ativo") === "true";
  if (typeof clienteId !== "string" || !clienteId) {
    return { error: "clienteId ausente" };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({ ativo })
    .eq("id", clienteId);
  if (error) return { error: error.message };

  revalidatePath(`/admin/clientes/${clienteId}`);
  revalidatePath("/admin");
  return { ok: true };
}

export async function deletarCliente(formData: FormData): Promise<
  { ok: true } | { error: string }
> {
  const auth = await validarAdmin();
  if ("error" in auth) return auth;

  const clienteId = formData.get("clienteId");
  if (typeof clienteId !== "string" || !clienteId) {
    return { error: "clienteId ausente" };
  }

  const supabase = await createClient();
  // CASCADE remove leads, mensagens, agendamentos, profiles, etc.
  const { error } = await supabase
    .from("organizations")
    .delete()
    .eq("id", clienteId);
  if (error) return { error: error.message };

  revalidatePath("/admin");
  return { ok: true };
}
