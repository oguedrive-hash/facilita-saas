import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import Link from "next/link";

export default async function AgendaPage() {
  const supabase = await createClient();

  // Próximos agendamentos (a partir de agora)
  const { data: proximosAgendamentos } = await supabase
    .from("agendamentos")
    .select(
      "id, data_inicio, data_fim, status, meet_link, lead_id, leads(nome, telefone)",
    )
    .gte("data_inicio", new Date().toISOString())
    .order("data_inicio", { ascending: true })
    .limit(20);

  // Agendamentos passados (últimos 30 dias)
  const trintaDiasAtras = new Date();
  trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

  const { data: agendamentosPassados } = await supabase
    .from("agendamentos")
    .select(
      "id, data_inicio, status, lead_id, leads(nome, telefone)",
    )
    .lt("data_inicio", new Date().toISOString())
    .gte("data_inicio", trintaDiasAtras.toISOString())
    .order("data_inicio", { ascending: false })
    .limit(20);

  return (
    <div>
      <PageHeader
        titulo="Agenda"
        descricao="Consultorias agendadas pelo Caio"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Próximas reuniões — coluna principal */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-heading font-bold text-preto mb-4">
            Próximas reuniões
          </h2>

          {!proximosAgendamentos || proximosAgendamentos.length === 0 ? (
            <EmptyState
              icone="📅"
              titulo="Agenda vazia"
              descricao="Quando o Caio agendar uma consultoria, vai aparecer aqui."
            />
          ) : (
            <div className="space-y-3">
              {proximosAgendamentos.map((a) => (
                <AgendamentoCard
                  key={a.id}
                  agendamento={a}
                  destaque
                />
              ))}
            </div>
          )}
        </div>

        {/* Coluna lateral — Histórico */}
        <div>
          <h2 className="text-lg font-heading font-bold text-preto mb-4">
            Últimos 30 dias
          </h2>

          {!agendamentosPassados || agendamentosPassados.length === 0 ? (
            <div className="bg-white rounded-2xl border border-cinza-claro p-6 text-center">
              <p className="text-sm text-cinza-medio">
                Sem histórico nos últimos 30 dias.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {agendamentosPassados.map((a) => (
                <AgendamentoCard
                  key={a.id}
                  agendamento={a}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

type LeadRef = { nome?: string | null; telefone?: string } | { nome?: string | null; telefone?: string }[] | null;

function AgendamentoCard({
  agendamento,
  destaque = false,
}: {
  agendamento: {
    id: string;
    data_inicio: string;
    data_fim?: string;
    status: string;
    meet_link?: string | null;
    lead_id: string;
    leads: LeadRef;
  };
  destaque?: boolean;
}) {
  const leadRef = agendamento.leads;
  const lead = Array.isArray(leadRef) ? leadRef[0] : leadRef;
  const data = new Date(agendamento.data_inicio);

  return (
    <div
      className={`bg-white rounded-xl border p-4 ${
        destaque ? "border-laranja/30" : "border-cinza-claro"
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="font-heading font-semibold text-preto">
            {lead?.nome ?? "Sem nome"}
          </p>
          <p className="text-xs text-cinza-medio font-mono mt-0.5">
            {lead?.telefone}
          </p>
        </div>
        <StatusAgendamento status={agendamento.status} />
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-sm font-heading font-semibold text-laranja">
          {data.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "short",
            weekday: "short",
          })}
        </span>
        <span className="text-cinza-claro">•</span>
        <span className="text-sm text-cinza-medio">
          {data.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        {agendamento.meet_link ? (
          <a
            href={agendamento.meet_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-laranja hover:underline font-heading font-semibold"
          >
            Link da reunião →
          </a>
        ) : (
          <span className="text-xs text-cinza-medio">Sem link</span>
        )}
        <Link
          href={`/dashboard/leads/${agendamento.lead_id}`}
          className="text-xs text-cinza-medio hover:text-laranja font-heading font-medium"
        >
          Ver lead
        </Link>
      </div>
    </div>
  );
}

function StatusAgendamento({ status }: { status: string }) {
  const config: Record<string, { label: string; cor: string }> = {
    agendado: { label: "Agendado", cor: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    realizado: { label: "Realizado", cor: "bg-blue-50 text-blue-700 border-blue-200" },
    no_show: { label: "No-show", cor: "bg-red-50 text-red-700 border-red-200" },
    cancelado: { label: "Cancelado", cor: "bg-cinza-claro text-cinza-medio border-cinza-claro" },
  };

  const c = config[status] ?? config.agendado;

  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-xs font-heading font-semibold border ${c.cor}`}
    >
      {c.label}
    </span>
  );
}
