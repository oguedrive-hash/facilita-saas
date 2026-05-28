import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusSelector } from "@/components/status-selector";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { STATUS_CONFIG, type StatusLead } from "@/lib/status-config";

type CaioFilter = "todos" | "on" | "off";
type Periodo = "todos" | "hoje" | "7d" | "30d";
type SortField = "updated_at" | "created_at" | "nome" | "status";
type SortOrder = "asc" | "desc";

type FilterParams = {
  status?: StatusLead | "todos";
  caio?: CaioFilter;
  q?: string;
  periodo?: Periodo;
  sort?: SortField;
  order?: SortOrder;
  page?: string;
};

const PER_PAGE = 25;

function calcularDesde(periodo: Periodo): string | null {
  const agora = new Date();
  if (periodo === "hoje") {
    agora.setHours(0, 0, 0, 0);
    return agora.toISOString();
  }
  if (periodo === "7d") {
    agora.setDate(agora.getDate() - 7);
    return agora.toISOString();
  }
  if (periodo === "30d") {
    agora.setDate(agora.getDate() - 30);
    return agora.toISOString();
  }
  return null;
}

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<FilterParams>;
}) {
  const params = await searchParams;
  const statusFilter = params.status ?? "todos";
  const caioFilter = params.caio ?? "todos";
  const searchQuery = params.q ?? "";
  const periodo = params.periodo ?? "todos";
  const sortField = params.sort ?? "updated_at";
  const sortOrder = params.order ?? "desc";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const offset = (page - 1) * PER_PAGE;

  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select(
      "id, nome, telefone, status, source, caio_ativo, created_at, updated_at",
      { count: "exact" },
    )
    .order(sortField, { ascending: sortOrder === "asc" })
    .range(offset, offset + PER_PAGE - 1);

  if (statusFilter !== "todos") {
    query = query.eq("status", statusFilter);
  }
  if (caioFilter === "on") query = query.eq("caio_ativo", true);
  if (caioFilter === "off") query = query.eq("caio_ativo", false);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().replace(/[%_]/g, "");
    query = query.or(`nome.ilike.%${q}%,telefone.ilike.%${q}%`);
  }
  const desde = calcularDesde(periodo);
  if (desde) query = query.gte("created_at", desde);

  // Paraleliza lista + contagens globais (pros chips de filtro)
  const [{ data: leads, error, count: totalLeads }, { data: contagensRaw }] =
    await Promise.all([
      query,
      supabase.from("leads").select("status, caio_ativo"),
    ]);

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

  const totalPages = Math.max(1, Math.ceil((totalLeads ?? 0) / PER_PAGE));

  function buildHref(opts: Partial<FilterParams>): string {
    const sp = new URLSearchParams();
    const s = opts.status ?? statusFilter;
    const c = opts.caio ?? caioFilter;
    const qq = opts.q ?? searchQuery;
    const p = opts.periodo ?? periodo;
    const sf = opts.sort ?? sortField;
    const so = opts.order ?? sortOrder;
    // Quando muda filtro, volta pra page 1
    const pg = opts.page ?? "1";
    if (s !== "todos") sp.set("status", s);
    if (c !== "todos") sp.set("caio", c);
    if (qq) sp.set("q", qq);
    if (p !== "todos") sp.set("periodo", p);
    if (sf !== "updated_at") sp.set("sort", sf);
    if (so !== "desc") sp.set("order", so);
    if (pg !== "1") sp.set("page", pg);
    const qs = sp.toString();
    return qs ? `/dashboard/leads?${qs}` : "/dashboard/leads";
  }

  function buildExportHref(): string {
    const sp = new URLSearchParams();
    if (statusFilter !== "todos") sp.set("status", statusFilter);
    if (caioFilter !== "todos") sp.set("caio", caioFilter);
    if (searchQuery) sp.set("q", searchQuery);
    if (periodo !== "todos") sp.set("periodo", periodo);
    if (sortField !== "updated_at") sp.set("sort", sortField);
    if (sortOrder !== "desc") sp.set("order", sortOrder);
    const qs = sp.toString();
    return qs ? `/api/leads/export?${qs}` : "/api/leads/export";
  }

  return (
    <div>
      <PageHeader
        titulo="Leads"
        descricao="Todos os leads capturados pelo Caio"
        acao={
          <a
            href={buildExportHref()}
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-white border border-cinza-claro hover:border-laranja text-preto font-heading font-semibold text-sm transition"
          >
            ⬇ Exportar CSV
          </a>
        }
      />

      {/* Busca */}
      <form method="get" action="/dashboard/leads" className="mb-4">
        {statusFilter !== "todos" && (
          <input type="hidden" name="status" value={statusFilter} />
        )}
        {caioFilter !== "todos" && (
          <input type="hidden" name="caio" value={caioFilter} />
        )}
        {periodo !== "todos" && (
          <input type="hidden" name="periodo" value={periodo} />
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

      {/* Filtros Caio + Período */}
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

        <div className="w-px h-6 bg-cinza-claro mx-1 self-center" />

        {(["todos", "hoje", "7d", "30d"] as Periodo[]).map((p) => (
          <FilterChip
            key={p}
            label={
              p === "todos"
                ? "Todo o período"
                : p === "hoje"
                  ? "Hoje"
                  : p === "7d"
                    ? "Últimos 7 dias"
                    : "Últimos 30 dias"
            }
            active={periodo === p}
            href={buildHref({ periodo: p })}
            variant="subtle"
          />
        ))}
      </div>

      {/* Erro */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
          <p className="text-sm text-red-800">
            Erro ao carregar leads: {error.message}
          </p>
        </div>
      )}

      {/* Lista vazia */}
      {!leads || leads.length === 0 ? (
        <EmptyState
          icone="📭"
          titulo="Nenhum lead encontrado"
          descricao={
            statusFilter === "todos" &&
            caioFilter === "todos" &&
            periodo === "todos"
              ? "Quando alguém mandar mensagem no WhatsApp, vai aparecer aqui automaticamente."
              : "Nenhum lead com os filtros atuais."
          }
        />
      ) : (
        <>
          <div className="bg-white rounded-2xl border border-cinza-claro">
            <table className="w-full">
              <thead className="bg-offwhite border-b border-cinza-claro">
                <tr>
                  <SortableTh
                    label="Nome / Telefone"
                    field="nome"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    buildHref={buildHref}
                  />
                  <SortableTh
                    label="Status"
                    field="status"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    buildHref={buildHref}
                  />
                  <Th>Origem</Th>
                  <SortableTh
                    label="Última atividade"
                    field="updated_at"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    buildHref={buildHref}
                  />
                  <SortableTh
                    label="Criado em"
                    field="created_at"
                    sortField={sortField}
                    sortOrder={sortOrder}
                    buildHref={buildHref}
                  />
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
                    <Td>
                      <span className="text-sm text-cinza-medio">
                        {new Date(lead.created_at).toLocaleDateString("pt-BR")}
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

          {/* Paginação */}
          <Paginator
            page={page}
            totalPages={totalPages}
            totalLeads={totalLeads ?? 0}
            offset={offset}
            shownInPage={leads.length}
            buildHref={buildHref}
          />
        </>
      )}
    </div>
  );
}

function SortableTh({
  label,
  field,
  sortField,
  sortOrder,
  buildHref,
}: {
  label: string;
  field: SortField;
  sortField: SortField;
  sortOrder: SortOrder;
  buildHref: (opts: Partial<FilterParams>) => string;
}) {
  const active = sortField === field;
  // Se já tá ordenando por esse campo, inverte. Senão, default desc.
  const nextOrder: SortOrder = active && sortOrder === "desc" ? "asc" : "desc";
  const arrow = active ? (sortOrder === "desc" ? "▼" : "▲") : "";
  return (
    <th className="px-6 py-3 text-left text-xs font-heading font-semibold text-cinza-medio uppercase tracking-wider">
      <Link
        href={buildHref({ sort: field, order: nextOrder })}
        className={`inline-flex items-center gap-1.5 hover:text-laranja transition ${
          active ? "text-laranja" : ""
        }`}
      >
        {label}
        <span className="text-[10px]">{arrow}</span>
      </Link>
    </th>
  );
}

function Paginator({
  page,
  totalPages,
  totalLeads,
  offset,
  shownInPage,
  buildHref,
}: {
  page: number;
  totalPages: number;
  totalLeads: number;
  offset: number;
  shownInPage: number;
  buildHref: (opts: Partial<FilterParams>) => string;
}) {
  if (totalLeads === 0) return null;
  const inicio = offset + 1;
  const fim = offset + shownInPage;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 mt-4 px-2">
      <p className="text-xs text-cinza-medio">
        Mostrando <strong className="text-preto">{inicio}</strong> a{" "}
        <strong className="text-preto">{fim}</strong> de{" "}
        <strong className="text-preto">{totalLeads}</strong> leads
      </p>
      <div className="flex items-center gap-1">
        <PageButton
          label="‹ Anterior"
          disabled={page <= 1}
          href={buildHref({ page: String(page - 1) })}
        />
        <span className="px-3 text-xs text-cinza-medio">
          Página {page} de {totalPages}
        </span>
        <PageButton
          label="Próxima ›"
          disabled={page >= totalPages}
          href={buildHref({ page: String(page + 1) })}
        />
      </div>
    </div>
  );
}

function PageButton({
  label,
  disabled,
  href,
}: {
  label: string;
  disabled: boolean;
  href: string;
}) {
  if (disabled) {
    return (
      <span className="px-3 py-1.5 text-xs text-cinza-medio rounded-lg bg-offwhite border border-cinza-claro opacity-50">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-xs text-preto rounded-lg bg-white border border-cinza-claro hover:border-laranja hover:text-laranja transition"
    >
      {label}
    </Link>
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
  count?: number;
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
      {count !== undefined && (
        <span
          className={`text-[10px] px-1.5 py-0.5 rounded-full ${
            active ? "bg-white/20" : "bg-cinza-claro"
          }`}
        >
          {count}
        </span>
      )}
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
