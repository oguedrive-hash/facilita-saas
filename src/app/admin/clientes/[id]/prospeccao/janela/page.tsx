import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { JanelaForm } from "./form";
import type { ProspeccaoJanela } from "../actions";

const DEFAULT: ProspeccaoJanela = {
  intervalo_minutos: 2,
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

  // Aceita shape novo OU antigo (com dias_semana/hora_inicio/etc) e normaliza
  // pro novo formato — campos antigos sao ignorados.
  const raw = cliente.prospeccao_janela as Record<string, unknown> | null;
  const janela: ProspeccaoJanela = {
    intervalo_minutos:
      typeof raw?.intervalo_minutos === "number" && raw.intervalo_minutos > 0
        ? raw.intervalo_minutos
        : DEFAULT.intervalo_minutos,
  };

  return <JanelaForm organizationId={cliente.id} janelaInicial={janela} />;
}
