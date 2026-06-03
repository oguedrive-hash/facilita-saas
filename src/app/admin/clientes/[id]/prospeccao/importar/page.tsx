import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ImportarForm } from "./form";

export default async function ImportarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: cliente, error } = await supabase
    .from("organizations")
    .select("id, name, prospeccao_config")
    .eq("id", id)
    .single();

  if (error || !cliente) notFound();

  const config = cliente.prospeccao_config as
    | { regras?: { ativo: boolean }[] }
    | null;
  const temCadenciaAtiva = (config?.regras ?? []).some((r) => r.ativo);

  return (
    <ImportarForm
      organizationId={cliente.id}
      temCadenciaAtiva={temCadenciaAtiva}
    />
  );
}
