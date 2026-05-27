import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { STATUS_CONFIG, type StatusLead } from "@/lib/status-config";

export default async function MetricasGlobaisPage() {
  const supabase = await createClient();

  // Contagens gerais
  const { count: totalClientes } = await supabase
    .from("organizations")
    .select("*", { count: "exact", head: true });

  const { count: clientesAtivos } = await supabase
    .from("organizations")
    .select("*", { count: "exact", head: true })
    .eq("ativo", true)
    .eq("inadimplente", false);

  const { count: inadimplentes } = await supabase
    .from("organizations")
    .select("*", { count: "exact", head: true })
    .eq("inadimplente", true);

  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  const { count: totalAgendamentos } = await supabase
    .from("agendamentos")
    .select("*", { count: "exact", head: true });

  // Leads por status (todos clientes)
  const { data: leadsRaw } = await supabase.from("leads").select("status");
  const leadsPorStatus: Record<string, number> = {};
  leadsRaw?.forEach((l) => {
    leadsPorStatus[l.status] = (leadsPorStatus[l.status] ?? 0) + 1;
  });

  // Clientes por plano
  const { data: orgsRaw } = await supabase.from("organizations").select("plano");
  const orgsPorPlano: Record<string, number> = {};
  orgsRaw?.forEach((o) => {
    orgsPorPlano[o.plano] = (orgsPorPlano[o.plano] ?? 0) + 1;
  });

  return (
    <div>
      <PageHeader
        titulo="Métricas globais"
        descricao="Visão consolidada de todos os clientes da Facilita Plus"
      />

      {/* Métricas principais */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <MetricaBig label="Total clientes" valor={totalClientes ?? 0} />
        <MetricaBig
          label="Ativos"
          valor={clientesAtivos ?? 0}
          accent="emerald"
        />
        <MetricaBig
          label="Inadimplentes"
          valor={inadimplentes ?? 0}
          accent="red"
        />
        <MetricaBig label="Leads totais" valor={totalLeads ?? 0} />
        <MetricaBig
          label="Agendamentos"
          valor={totalAgendamentos ?? 0}
          accent="blue"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Leads por status */}
        <Card titulo="Leads por status (todos clientes)">
          {Object.keys(leadsPorStatus).length === 0 ? (
            <p className="text-sm text-cinza-medio text-center py-6">
              Nenhum lead capturado ainda.
            </p>
          ) : (
            <div className="space-y-2">
              {(Object.keys(STATUS_CONFIG) as StatusLead[])
                .sort(
                  (a, b) => STATUS_CONFIG[a].ordem - STATUS_CONFIG[b].ordem,
                )
                .filter((s) => (leadsPorStatus[s] ?? 0) > 0)
                .map((s) => {
                  const valor = leadsPorStatus[s] ?? 0;
                  const total = totalLeads ?? 1;
                  const pct = Math.round((valor / total) * 100);
                  return (
                    <div key={s}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-heading font-medium text-preto">
                          {STATUS_CONFIG[s].label}
                        </span>
                        <span className="text-cinza-medio">
                          {valor} <span className="text-xs">({pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-2 bg-cinza-claro rounded-full overflow-hidden">
                        <div
                          className={`h-full ${STATUS_CONFIG[s].cor.replace("text-", "bg-")}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </Card>

        {/* Clientes por plano */}
        <Card titulo="Clientes por plano">
          {Object.keys(orgsPorPlano).length === 0 ? (
            <p className="text-sm text-cinza-medio text-center py-6">
              Nenhum cliente cadastrado ainda.
            </p>
          ) : (
            <div className="space-y-3">
              {Object.entries(orgsPorPlano).map(([plano, valor]) => {
                const labels: Record<string, string> = {
                  mensal_basico: "Básico",
                  mensal_pro: "Pro",
                  mensal_enterprise: "Enterprise",
                };
                return (
                  <div
                    key={plano}
                    className="flex items-center justify-between p-3 bg-offwhite rounded-lg"
                  >
                    <span className="font-heading font-medium text-preto">
                      {labels[plano] ?? plano}
                    </span>
                    <span className="text-2xl font-heading font-bold text-laranja">
                      {valor}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6 p-6 bg-amber-50 border border-amber-200 rounded-2xl">
        <p className="text-sm text-amber-900">
          🚧 Em construção: gráficos de evolução temporal (leads/mês, MRR),
          taxa de conversão por cliente, comparação entre meses, etc.
        </p>
      </div>
    </div>
  );
}

function MetricaBig({
  label,
  valor,
  accent = "default",
}: {
  label: string;
  valor: number;
  accent?: "default" | "emerald" | "red" | "blue";
}) {
  const accents = {
    default: "text-preto",
    emerald: "text-emerald-600",
    red: "text-red-600",
    blue: "text-blue-600",
  };

  return (
    <div className="bg-white rounded-2xl border border-cinza-claro p-5">
      <p className="text-xs font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1">
        {label}
      </p>
      <p className={`text-3xl font-heading font-bold ${accents[accent]}`}>
        {valor}
      </p>
    </div>
  );
}

function Card({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-cinza-claro p-6">
      <h2 className="text-lg font-heading font-bold text-preto mb-4">
        {titulo}
      </h2>
      {children}
    </div>
  );
}
