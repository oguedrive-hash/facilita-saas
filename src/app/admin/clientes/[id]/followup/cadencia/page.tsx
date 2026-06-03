import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CadenciaForm } from "./form";
import type { FollowupRegra } from "../actions";

export default async function CadenciaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: cliente, error } = await supabase
    .from("organizations")
    .select("id, followup_config, followup_mudar_status_a_partir")
    .eq("id", id)
    .single();

  if (error || !cliente) notFound();

  const config = cliente.followup_config as
    | { regras?: FollowupRegra[] }
    | null;

  return (
    <CadenciaForm
      organizationId={cliente.id}
      regrasIniciais={config?.regras ?? []}
      mudarStatusAPartirInicial={cliente.followup_mudar_status_a_partir ?? 1}
    />
  );
}
