import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { TimelineMensagens } from "@/components/timeline-mensagens";
import { STATUS_CONFIG, type StatusLead } from "@/lib/status-config";

export default async function LeadDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: lead, error } = await supabase
    .from("leads")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !lead) {
    notFound();
  }

  // Busca agendamentos vinculados
  const { data: agendamentos } = await supabase
    .from("agendamentos")
    .select("id, data_inicio, data_fim, status, meet_link, observacoes")
    .eq("lead_id", id)
    .order("data_inicio", { ascending: false });

  // Busca histórico de mensagens
  const { data: mensagens } = await supabase
    .from("mensagens")
    .select(
      "id, conteudo, tipo, attachment_url, direcao, remetente_nome, created_at",
    )
    .eq("lead_id", id)
    .order("created_at", { ascending: true });

  const statusConfig = STATUS_CONFIG[lead.status as StatusLead];

  return (
    <div>
      {/* Breadcrumb */}
      <Link
        href="/dashboard/leads"
        className="inline-flex items-center text-sm text-cinza-medio hover:text-laranja font-heading font-medium mb-4 transition"
      >
        ← Voltar pra Leads
      </Link>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-cinza-claro p-8 mb-6">
        <div className="flex items-start justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-heading font-bold text-preto mb-1">
              {lead.nome ?? "Sem nome"}
            </h1>
            <p className="text-sm text-cinza-medio font-mono">
              {lead.telefone}
            </p>
          </div>
          <StatusBadge status={lead.status as StatusLead} />
        </div>

        {/* Status descrição */}
        <div
          className={`inline-block px-3 py-1.5 rounded-lg text-xs ${statusConfig.bg} ${statusConfig.cor} border ${statusConfig.border}`}
        >
          {statusConfig.descricao}
        </div>

        {/* Razão (se houver) */}
        {lead.razao && (
          <div className="mt-4 p-4 bg-offwhite rounded-lg border border-cinza-claro">
            <p className="text-xs font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1">
              Razão / Observação
            </p>
            <p className="text-sm text-preto">{lead.razao}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Coluna esquerda — Info */}
        <div className="md:col-span-2 space-y-6">
          {/* Histórico de mensagens */}
          <Card titulo="Conversa">
            <TimelineMensagens mensagens={mensagens ?? []} />
          </Card>

          {/* Agendamentos */}
          <Card titulo="Agendamentos">
            {!agendamentos || agendamentos.length === 0 ? (
              <p className="text-sm text-cinza-medio text-center py-6">
                Nenhuma consultoria agendada ainda.
              </p>
            ) : (
              <ul className="space-y-3">
                {agendamentos.map((a) => (
                  <li
                    key={a.id}
                    className="p-4 bg-offwhite rounded-lg border border-cinza-claro"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-heading font-semibold text-preto">
                        {new Date(a.data_inicio).toLocaleString("pt-BR")}
                      </p>
                      <span className="text-xs font-heading font-semibold text-cinza-medio uppercase">
                        {a.status}
                      </span>
                    </div>
                    {a.meet_link && (
                      <a
                        href={a.meet_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-laranja hover:underline"
                      >
                        Link da reunião →
                      </a>
                    )}
                    {a.observacoes && (
                      <p className="text-sm text-cinza-medio mt-2">
                        {a.observacoes}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        {/* Coluna direita — Metadata */}
        <div className="space-y-6">
          <Card titulo="Detalhes">
            <dl className="space-y-3">
              <DataRow label="Origem" valor={lead.source} />
              <DataRow
                label="Criado em"
                valor={new Date(lead.created_at).toLocaleString("pt-BR")}
              />
              <DataRow
                label="Última atividade"
                valor={new Date(lead.updated_at).toLocaleString("pt-BR")}
              />
              {lead.numero_followup > 0 && (
                <DataRow
                  label="Follow-ups enviados"
                  valor={String(lead.numero_followup)}
                />
              )}
              {lead.proximo_followup_em && (
                <DataRow
                  label="Próximo follow-up"
                  valor={new Date(lead.proximo_followup_em).toLocaleString("pt-BR")}
                />
              )}
              {lead.chatwoot_conversation_id && (
                <DataRow
                  label="Chatwoot ID"
                  valor={`#${lead.chatwoot_conversation_id}`}
                />
              )}
            </dl>
          </Card>
        </div>
      </div>
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

function DataRow({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-0.5">
        {label}
      </dt>
      <dd className="text-sm text-preto">{valor}</dd>
    </div>
  );
}
