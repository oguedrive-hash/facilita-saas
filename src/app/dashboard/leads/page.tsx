import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusSelector } from "@/components/status-selector";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { STATUS_CONFIG, type StatusLead } from "@/lib/status-config";

type FilterParams = {
  status?: StatusLead | "todos";
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const { status: statusFilter = "todos" } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select(
      "id, nome, telefone, status, source, caio_ativo, created_at, updated_at",
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (statusFilter !== "todos") {
    query = query.eq("status", statusFilter);
  }

  const { data: leads, error } = await query;

  // Contagens por status (pro filtro)
  const { data: contagensRaw } = await supabase.from("leads").select("status");
  const contagens: Record<string, number> = { todos: contagensRaw?.length ?? 0 };
  contagensRaw?.forEach((l) => {
    contagens[l.status] = (contagens[l.status] ?? 0) + 1;
  });

  return (
    <div>
      <PageHeader
        titulo="Leads"
        descricao="Todos os leads capturados pelo Caio"
      />

      {/* Filtros de status */}
      <div className="flex flex-wrap gap-2 mb-6">
        <FilterChip
          label="Todos"
          count={contagens.todos}
          active={statusFilter === "todos"}
          href="/dashboard/leads"
        />
        {(Object.keys(STATUS_CONFIG) as StatusLead[])
          .sort((a, b) => STATUS_CONFIG[a].ordem - STATUS_CONFIG[b].ordem)
          .map((status) => (
            <FilterChip
              key={status}
              label={STATUS_CONFIG[status].label}
              count={contagens[status] ?? 0}
              active={statusFilter === status}
              href={`/dashboard/leads?status=${status}`}
            />
          ))}
      </div>

      {/* Erro */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <p className="text-sm text-red-800">Erro ao carregar leads: {error.message}</p>
        </div>
      )}

      {/* Lista vazia */}
      {!leads || leads.length === 0 ? (
        <EmptyState
          icone="📭"
          titulo="Nenhum lead ainda"
          descricao={
            statusFilter === "todos"
              ? "Quando alguém mandar mensagem no WhatsApp, vai aparecer aqui automaticamente."
              : `Nenhum lead com status "${STATUS_CONFIG[statusFilter as StatusLead]?.label}" no momento.`
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-cinza-claro overflow-hidden">
          <table className="w-full">
            <thead className="bg-offwhite border-b border-cinza-claro">
              <tr>
                <Th>Nome / Telefone</Th>
                <Th>Status</Th>
                <Th>Origem</Th>
                <Th>Última atividade</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-cinza-claro last:border-0 hover:bg-offwhite/50 transition"
                >
                  <Td>
                    <div>
                      <p className="font-heading font-semibold text-preto">
                        {lead.nome ?? "Sem nome"}
                      </p>
                      <p className="text-xs text-cinza-medio font-mono mt-0.5">
                        {lead.telefone}
                      </p>
                    </div>
                  </Td>
                  <Td>
                    <div className="flex flex-col items-start gap-1.5">
                      <StatusSelector
                        leadId={lead.id}
                        statusAtual={lead.status as StatusLead}
                      />
                      <CaioBadge ativo={lead.caio_ativo ?? true} />
                    </div>
                  </Td>
                  <Td>
                    <span className="text-sm text-cinza-medio">
                      {lead.source}
                    </span>
                  </Td>
                  <Td>
                    <span className="text-sm text-cinza-medio">
                      {formatRelativeDate(lead.updated_at)}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="text-sm text-laranja hover:text-laranja-escuro font-heading font-semibold"
                    >
                      Ver →
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  href,
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-heading font-medium transition ${
        active
          ? "bg-preto text-white"
          : "bg-white text-cinza-medio border border-cinza-claro hover:border-laranja hover:text-preto"
      }`}
    >
      {label}
      <span
        className={`text-xs px-1.5 py-0.5 rounded-full ${
          active ? "bg-white/20" : "bg-cinza-claro"
        }`}
      >
        {count}
      </span>
    </Link>
  );
}

function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`px-6 py-3 text-left text-xs font-heading font-semibold text-cinza-medio uppercase tracking-wider ${className}`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-6 py-4 ${className}`}>{children}</td>;
}

function CaioBadge({ ativo }: { ativo: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-heading font-semibold border ${
        ativo
          ? "bg-green-50 text-green-700 border-green-300"
          : "bg-red-50 text-red-700 border-red-300"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${ativo ? "bg-green-500" : "bg-red-500"}`}
      />
      {ativo ? "Caio respondendo" : "Caio desligado"}
    </span>
  );
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHrs = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `${diffMin}min atrás`;
  if (diffHrs < 24) return `${diffHrs}h atrás`;
  if (diffDays < 7) return `${diffDays}d atrás`;
  return date.toLocaleDateString("pt-BR");
}
