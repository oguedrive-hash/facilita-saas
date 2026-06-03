import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JanelaForm } from "./form";
import type { ProspeccaoJanela } from "../actions";

const DEFAULT: ProspeccaoJanela = {
  dias_semana: [1, 2, 3, 4, 5],
  hora_inicio: 9,
  hora_fim: 18,
  rate_limit_hora: 10,
};

export default async function JanelaProspeccaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: cliente, error } = await supabase
    .from("organizations")
    .select("id, prospeccao_janela")
    .eq("id", id)
    .single();

  if (error || !cliente) notFound();

  const janela = (cliente.prospeccao_janela as ProspeccaoJanela | null) ?? DEFAULT;

  return <JanelaForm organizationId={cliente.id} janelaInicial={janela} />;
}
