import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  const { count: leadsAgendados } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("status", "reuniao_agendada");

  const { count: leadsEmConversa } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .eq("status", "em_conversa");

  return (
    <div>
      <div className="mb-10">
        <h1 className="text-4xl font-heading font-bold text-preto">
          Dashboard
        </h1>
        <p className="text-sm text-cinza-medio mt-1">
          Visão geral do seu pré-vendedor IA
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-10">
        <MetricCard
          titulo="Total de Leads"
          valor={totalLeads ?? 0}
          descricao="Todos os tempos"
        />
        <MetricCard
          titulo="Em conversa"
          valor={leadsEmConversa ?? 0}
          descricao="Caio conversando agora"
          destaque
        />
        <MetricCard
          titulo="Reuniões agendadas"
          valor={leadsAgendados ?? 0}
          descricao="Aguardando consultoria"
        />
      </div>

      <div className="bg-white rounded-2xl border border-cinza-claro p-10 text-center">
        <p className="text-cinza-medio font-medium">
          🚧 Em construção — timeline de atividades, leads recentes, gráficos
        </p>
        <p className="text-xs text-cinza-medio mt-3 font-mono">
          User ID: {user?.id}
        </p>
      </div>
    </div>
  );
}

function MetricCard({
  titulo,
  valor,
  descricao,
  destaque = false,
}: {
  titulo: string;
  valor: number;
  descricao: string;
  destaque?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border p-6 ${
        destaque
          ? "border-laranja shadow-sm shadow-laranja/10"
          : "border-cinza-claro"
      }`}
    >
      <p className="text-sm font-heading font-medium text-cinza-medio">
        {titulo}
      </p>
      <p
        className={`text-4xl font-heading font-bold mt-2 ${
          destaque ? "text-laranja" : "text-preto"
        }`}
      >
        {valor}
      </p>
      <p className="text-xs text-cinza-medio mt-2">{descricao}</p>
    </div>
  );
}
