import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusSelector } from "@/components/status-selector";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { STATUS_CONFIG, type StatusLead } from "@/lib/status-config";

type CaioFilter = "todos" | "on" | "off";

type FilterParams = {
  status?: StatusLead | "todos";
  caio?: CaioFilter;
  q?: string;
};

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const {
    status: statusFilter = "todos",
    caio: caioFilter = "todos",
    q: searchQuery = "",
  } = await searchParams;
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
  if (caioFilter === "on") query = query.eq("caio_ativo", true);
  if (caioFilter === "off") query = query.eq("caio_ativo", false);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().replace(/[%_]/g, ""); // escapa wildcards SQL
    query = query.or(`nome.ilike.%${q}%,telefone.ilike.%${q}%`);
  }

  const { data: leads, error } = await query;

  // Contagens por status e caio (pros filtros)
  const { data: contagensRaw } = await supabase
    .from("leads")
    .select("status, caio_ativo");
  const contagens: Record<string, number> = {
    todos: contagensRaw?.length ?? 0,
    caio_on: 0,
    caio_off: 0,
  };
  contagensRaw?.forEach((l) => {
    contagens[l.status] = (contagens[l.status] ?? 0) + 1;
    if (l.caio_ativo) contagens.caio_on++;
    else contagens.caio_off++;
  });

  function buildHref(opts: {
    status?: StatusLead | "todos";
    caio?: CaioFilter;
    q?: string;
  }): string {
    const params = new URLSearchParams();
    const s = opts.status ?? statusFilter;
    const c = opts.caio ?? caioFilter;
    const qq = opts.q ?? searchQuery;
    if (s !== "todos") params.set("status", s);
    if (c !== "todos") params.set("caio", c);
    if (qq) params.set("q", qq);
    const qs = params.toString();
    return qs ? `/dashboard/leads?${qs}` : "/dashboard/leads";
  }

  return (
    <div>
      <PageHeader
        titulo="Leads"
        descricao="Todos os leads capturados pelo Caio"
      />

      {/* Busca */}
      <form method="get" action="/dashboard/leads" className="mb-4">
        {/* Preserva os filtros atuais como hidden inputs */}
        {statusFilter !== "todos" && (
          <input type="hidden" name="status" value={statusFilter} />
        )}
        {caioFilter !== "todos" && (
          <input type="hidden" name="caio" value={caioFilter} />
        )}
        <div className="flex items-center gap-2 max-w-md">
          <input
            type="search"
            name="q"
            defaultValue={searchQuery}
            placeholder="Buscar por nome ou telefone..."
            className="flex-1 px-3 py-2 border border-cinza-claro rounded-lg text-sm text-preto placeholder:text-cinza-medio focus:outline-none focus:border-laranja transition"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-preto text-white text-sm font-heading font-semibold rounded-lg hover:opacity-90 transition"
          >
            Buscar
          </button>
          {searchQuery && (
            <Link
              href={buildHref({ q: "" })}
              className="px-3 py-2 text-sm text-cinza-medio hover:text-preto transition"
            >
              Limpar
            </Link>
          )}
        </div>
      </form>

      {/* Filtros de status */}
      <div className="flex flex-wrap gap-2 mb-3">
        <FilterChip
          label="Todos"
          count={contagens.todos}
          active={statusFilter === "todos"}
          href={buildHref({ status: "todos" })}
        />
        {(Object.keys(STATUS_CONFIG) as StatusLead[])
          .sort((a, b) => STATUS_CONFIG[a].ordem - STATUS_CONFIG[b].ordem)
          .map((status) => (
            <FilterChip
              key={status}
              label={STATUS_CONFIG[status].label}
              count={contagens[status] ?? 0}
              active={statusFilter === status}
              href={buildHref({ status })}
            />
          ))}
      </div>

      {/* Filtros do Caio */}
      <div className="flex flex-wrap gap-2 mb-6">
        <FilterChip
          label="Caio: todos"
          count={contagens.todos}
          active={caioFilter === "todos"}
          href={buildHref({ caio: "todos" })}
          variant="subtle"
        />
        <FilterChip
          label="🟢 Caio respondendo"
          count={contagens.caio_on}
          active={caioFilter === "on"}
          href={buildHref({ caio: "on" })}
          variant="subtle"
        />
        <FilterChip
          label="🔴 Caio desligado"
          count={contagens.caio_off}
          active={caioFilter === "off"}
          href={buildHref({ caio: "off" })}
          variant="subtle"
        />
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
          titulo="Nenhum lead encontrado"
          descricao={
            statusFilter === "todos" && caioFilter === "todos"
              ? "Quando alguém mandar mensagem no WhatsApp, vai aparecer aqui automaticamente."
              : "Nenhum lead com os filtros atuais."
          }
        />
      ) : (
        <div className="bg-white rounded-2xl border border-cinza-claro">
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
  variant = "default",
}: {
  label: string;
  count: number;
  active: boolean;
  href: string;
  variant?: "default" | "subtle";
}) {
  const baseSize =
    variant === "subtle" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full font-heading font-medium transition ${baseSize} ${
        active
          ? "bg-preto text-white"
          : "bg-white text-cinza-medio border border-cinza-claro hover:border-laranja hover:text-preto"
      }`}
    >
      {label}
      <span
        className={`text-[10px] px-1.5 py-0.5 rounded-full ${
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
