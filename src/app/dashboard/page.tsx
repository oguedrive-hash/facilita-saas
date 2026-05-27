import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  STATUS_CONFIG,
  STATUS_ORDEM,
  type StatusLead,
} from "@/lib/status-config";

export default async function DashboardPage() {
  const supabase = await createClient();

  // Busca todos os leads (com info pra agregação)
  const { data: leads } = await supabase
    .from("leads")
    .select("id, nome, telefone, status, caio_ativo, created_at, updated_at");

  const total = leads?.length ?? 0;

  // Contagens por status
  const porStatus: Record<string, number> = {};
  STATUS_ORDEM.forEach((s) => (porStatus[s] = 0));
  leads?.forEach((l) => {
    porStatus[l.status] = (porStatus[l.status] ?? 0) + 1;
  });

  // Métricas chave
  const emConversa = porStatus.em_conversa ?? 0;
  const reuniao = porStatus.reuniao_agendada ?? 0;
  const fechou = porStatus.fechou ?? 0;
  const perdido = porStatus.perdido ?? 0;
  const concluidos = fechou + perdido;
  const taxaConversao = concluidos > 0 ? (fechou / concluidos) * 100 : 0;

  const caioOff = leads?.filter((l) => !l.caio_ativo).length ?? 0;

  // Leads dos últimos 7 dias agrupados por dia
  const hoje = new Date();
  hoje.setHours(23, 59, 59, 999);
  const dias: { dia: string; label: string; quantidade: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(hoje);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    const dEnd = new Date(d);
    dEnd.setHours(23, 59, 59, 999);
    const count =
      leads?.filter((l) => {
        const c = new Date(l.created_at);
        return c >= d && c <= dEnd;
      }).length ?? 0;
    dias.push({
      dia: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit" }),
      quantidade: count,
    });
  }
  const maxDia = Math.max(...dias.map((d) => d.quantidade), 1);

  // Leads recentes (top 5 por última atividade)
  const leadsRecentes = (leads ?? [])
    .slice()
    .sort(
      (a, b) =>
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
    )
    .slice(0, 5);

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-4xl font-heading font-bold text-preto">Dashboard</h1>
        <p className="text-sm text-cinza-medio mt-1">
          Visão geral do seu pré-vendedor IA
        </p>
      </div>

      {/* Métricas chave */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <MetricCard titulo="Total de leads" valor={total} />
        <MetricCard
          titulo="Em conversa"
          valor={emConversa}
          destaque
          descricao="Caio conversando agora"
        />
        <MetricCard
          titulo="Reuniões agendadas"
          valor={reuniao}
          descricao="Aguardando consultoria"
        />
        <MetricCard
          titulo="Taxa de conversão"
          valor={taxaConversao}
          sufixo="%"
          descricao={`${fechou} fechou / ${perdido} perdeu`}
        />
      </div>

      {/* Linha 2: gráfico + distribuição */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Leads nos últimos 7 dias */}
        <Card titulo="Leads novos — últimos 7 dias">
          <div className="flex items-end gap-3 h-44">
            {dias.map((d) => {
              const altura = (d.quantidade / maxDia) * 100;
              return (
                <div
                  key={d.dia}
                  className="flex-1 flex flex-col items-center justify-end gap-2"
                >
                  <span className="text-xs font-heading font-semibold text-preto">
                    {d.quantidade}
                  </span>
                  <div
                    className="w-full bg-laranja rounded-t-md transition"
                    style={{ height: `${altura}%`, minHeight: "4px" }}
                  />
                  <span className="text-[10px] text-cinza-medio uppercase tracking-wider">
                    {d.label}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Distribuição por status */}
        <Card titulo="Distribuição por status">
          {total === 0 ? (
            <p className="text-sm text-cinza-medio text-center py-10">
              Nenhum lead ainda.
            </p>
          ) : (
            <ul className="space-y-2.5">
              {STATUS_ORDEM.filter((s) => porStatus[s] > 0).map((s) => {
                const config = STATUS_CONFIG[s];
                const count = porStatus[s];
                const pct = (count / total) * 100;
                return (
                  <li key={s}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-heading font-medium text-preto">
                        {config.label}
                      </span>
                      <span className="text-xs text-cinza-medio">
                        {count} ({pct.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="h-2 bg-cinza-claro rounded-full overflow-hidden">
                      <div
                        className={`h-full ${config.cor.replace("text-", "bg-")} rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {/* Linha 3: leads recentes + alertas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card titulo="Atividade recente">
            {leadsRecentes.length === 0 ? (
              <p className="text-sm text-cinza-medio text-center py-10">
                Nenhum lead ainda.
              </p>
            ) : (
              <ul className="divide-y divide-cinza-claro">
                {leadsRecentes.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/dashboard/leads/${l.id}`}
                      className="flex items-center justify-between gap-3 py-3 hover:bg-offwhite/50 transition px-2 -mx-2 rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-heading font-semibold text-preto truncate">
                          {l.nome ?? "Sem nome"}
                        </p>
                        <p className="text-xs text-cinza-medio font-mono">
                          {l.telefone}
                        </p>
                      </div>
                      <span
                        className={`text-[10px] font-heading font-semibold px-2 py-0.5 rounded-full border ${STATUS_CONFIG[l.status as StatusLead].bg} ${STATUS_CONFIG[l.status as StatusLead].cor} ${STATUS_CONFIG[l.status as StatusLead].border}`}
                      >
                        {STATUS_CONFIG[l.status as StatusLead].label}
                      </span>
                      <span className="text-xs text-cinza-medio whitespace-nowrap">
                        {formatRelative(l.updated_at)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card titulo="Status do Caio">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-preto">Respondendo</span>
              <span className="text-sm font-heading font-bold text-green-700">
                {total - caioOff}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-preto">Humano assumiu</span>
              <span className="text-sm font-heading font-bold text-red-700">
                {caioOff}
              </span>
            </div>
            {caioOff > 0 && (
              <Link
                href="/dashboard/leads?caio=off"
                className="block mt-3 text-xs text-laranja hover:text-laranja-escuro font-heading font-semibold"
              >
                Ver os {caioOff} →
              </Link>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  titulo,
  valor,
  descricao,
  destaque = false,
  sufixo = "",
}: {
  titulo: string;
  valor: number;
  descricao?: string;
  destaque?: boolean;
  sufixo?: string;
}) {
  const valorFormatado =
    sufixo === "%" ? valor.toFixed(1) : Math.round(valor).toString();
  return (
    <div
      className={`bg-white rounded-2xl border p-5 ${
        destaque
          ? "border-laranja shadow-sm shadow-laranja/10"
          : "border-cinza-claro"
      }`}
    >
      <p className="text-xs font-heading font-medium text-cinza-medio uppercase tracking-wider">
        {titulo}
      </p>
      <p
        className={`text-3xl font-heading font-bold mt-2 ${
          destaque ? "text-laranja" : "text-preto"
        }`}
      >
        {valorFormatado}
        {sufixo && (
          <span className="text-lg ml-0.5 text-cinza-medio">{sufixo}</span>
        )}
      </p>
      {descricao && (
        <p className="text-xs text-cinza-medio mt-2">{descricao}</p>
      )}
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
      <h2 className="text-sm font-heading font-bold text-preto mb-4 uppercase tracking-wider">
        {titulo}
      </h2>
      {children}
    </div>
  );
}

function formatRelative(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min`;
  if (diffHrs < 24) return `${diffHrs}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString("pt-BR");
}
