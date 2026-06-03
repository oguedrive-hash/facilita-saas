import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PosVendaForm } from "./form";
import type { LembreteReuniaoConfig } from "../actions";

export default async function PosVendaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: cliente, error } = await supabase
    .from("organizations")
    .select("id, lembrete_reuniao_config")
    .eq("id", id)
    .single();

  if (error || !cliente) notFound();

  const lembreteConfig =
    cliente.lembrete_reuniao_config as LembreteReuniaoConfig | null;
  const regrasDepois =
    lembreteConfig?.regras?.filter((r) => r.quando === "depois") ?? [];

  return (
    <PosVendaForm
      organizationId={cliente.id}
      regrasIniciais={regrasDepois}
    />
  );
}
