import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { FollowupProspeccaoForm } from "./form";
import type { ProspeccaoFollowupConfig } from "../actions";

export default async function FollowupProspeccaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: cliente, error } = await supabase
    .from("organizations")
    .select("id, prospeccao_followup_config")
    .eq("id", id)
    .single();

  if (error || !cliente) notFound();

  const config = cliente.prospeccao_followup_config as
    | ProspeccaoFollowupConfig
    | null;

  return (
    <FollowupProspeccaoForm
      organizationId={cliente.id}
      regrasIniciais={config?.regras ?? []}
    />
  );
}
