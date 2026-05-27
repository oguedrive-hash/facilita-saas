"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type CadastrarClienteResult = {
  error?: string;
  success?: boolean;
};

export async function cadastrarClienteAction(
  _prev: CadastrarClienteResult,
  formData: FormData,
): Promise<CadastrarClienteResult> {
  const supabase = await createClient();

  // Verifica que quem tá fazendo é admin
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
    return { error: "Apenas administradores podem cadastrar clientes" };
  }

  // Extrai dados do form
  const name = (formData.get("name") as string)?.trim();
  const email_contato = (formData.get("email_contato") as string)?.trim();
  const whatsapp_numero = (formData.get("whatsapp_numero") as string)?.trim();
  const plano = formData.get("plano") as string;

  // Validações básicas
  if (!name) return { error: "Nome da empresa é obrigatório" };
  if (!email_contato) return { error: "Email de contato é obrigatório" };
  if (!plano) return { error: "Selecione um plano" };
  if (!["mensal_basico", "mensal_pro", "mensal_enterprise"].includes(plano)) {
    return { error: "Plano inválido" };
  }

  // Insere na tabela organizations
  const { error: insertError } = await supabase
    .from("organizations")
    .insert({
      name,
      email_contato,
      whatsapp_numero: whatsapp_numero || null,
      plano,
      ativo: true,
      inadimplente: false,
    });

  if (insertError) {
    return { error: `Erro ao cadastrar: ${insertError.message}` };
  }

  // TODO: provisionamento automático (próximos passos)
  // - Criar conta no Supabase Auth com email_contato
  // - Vincular profile à organization (já tem o trigger handle_new_user)
  // - Atualizar profile pra setar organization_id
  // - Criar cliente no Asaas
  // - Provisionar instância Evolution (chip_numero)
  // - Provisionar inbox Chatwoot
  // - Enviar email com link pra senha

  revalidatePath("/admin");
  redirect("/admin");
}
