import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReativacaoForm } from "./form";
import { normalizarReativacao } from "../_shared/reativacao-helpers";

export default async function ReativacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: cliente, error } = await supabase
    .from("organizations")
    .select("id, followup_config")
    .eq("id", id)
    .single();

  if (error || !cliente) notFound();

  const config = cliente.followup_config as
    | { reativacao?: unknown }
    | null;
  const reativacao = normalizarReativacao(config?.reativacao);

  return (
    <ReativacaoForm
      organizationId={cliente.id}
      reativacaoInicial={reativacao}
    />
  );
}
