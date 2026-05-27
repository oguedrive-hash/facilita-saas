"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EditarClienteResult = {
  error?: string;
  success?: boolean;
};

export async function editarClienteAction(
  _prev: EditarClienteResult,
  formData: FormData,
): Promise<EditarClienteResult> {
  const supabase = await createClient();

  // Valida admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Não autenticado" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Apenas administradores podem editar clientes" };
  }

  const id = formData.get("id") as string;
  if (!id) return { error: "ID do cliente não informado" };

  const name = (formData.get("name") as string)?.trim();
  const email_contato = (formData.get("email_contato") as string)?.trim();
  const whatsapp_numero = (formData.get("whatsapp_numero") as string)?.trim();
  const plano = formData.get("plano") as string;
  const prompt_system = (formData.get("prompt_system") as string)?.trim();
  const voice_id = (formData.get("voice_id") as string)?.trim();
  const ativo = formData.get("ativo") === "on";

  if (!name) return { error: "Nome é obrigatório" };
  if (!email_contato) return { error: "Email é obrigatório" };

  const { error: updateError } = await supabase
    .from("organizations")
    .update({
      name,
      email_contato,
      whatsapp_numero: whatsapp_numero || null,
      plano,
      prompt_system: prompt_system || null,
      voice_id: voice_id || null,
      ativo,
    })
    .eq("id", id);

  if (updateError) {
    return { error: `Erro ao atualizar: ${updateError.message}` };
  }

  revalidatePath("/admin");
  revalidatePath(`/admin/clientes/${id}`);
  redirect(`/admin/clientes/${id}`);
}
