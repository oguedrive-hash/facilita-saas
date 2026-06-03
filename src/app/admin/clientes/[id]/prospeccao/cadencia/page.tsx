import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CadenciaForm } from "./form";
import type { ProspeccaoConfig } from "../actions";

export default async function CadenciaProspeccaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: cliente, error } = await supabase
    .from("organizations")
    .select("id, prospeccao_config")
    .eq("id", id)
    .single();

  if (error || !cliente) notFound();

  const config = cliente.prospeccao_config as ProspeccaoConfig | null;

  return (
    <CadenciaForm
      organizationId={cliente.id}
      regrasIniciais={config?.regras ?? []}
    />
  );
}
