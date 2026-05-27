import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";

export default async function AdminPage() {
  const supabase = await createClient();

  const { data: clientes } = await supabase
    .from("organizations")
    .select("id, name, email_contato, whatsapp_numero, plano, ativo, inadimplente, created_at")
    .order("created_at", { ascending: false });

  // Métricas globais rápidas
  const { count: totalClientes } = await supabase
    .from("organizations")
    .select("*", { count: "exact", head: true });

  const { count: clientesAtivos } = await supabase
    .from("organizations")
    .select("*", { count: "exact", head: true })
    .eq("ativo", true)
    .eq("inadimplente", false);

  const { count: totalLeads } = await supabase
    .from("leads")
    .select("*", { count: "exact", head: true });

  return (
    <div>
      <PageHeader
        titulo="Clientes"
        descricao="Todas as empresas que usam a Facilita Plus"
        acao={
          <Link
            href="/admin/clientes/novo"
            className="inline-flex items-center px-4 py-2.5 rounded-lg bg-laranja hover:bg-laranja-escuro text-white font-heading font-semibold text-sm transition"
          >
            + Cadastrar cliente
          </Link>
        }
      />

      {/* Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <MetricaCard label="Total de clientes" valor={totalClientes ?? 0} />
        <MetricaCard
          label="Clientes ativos"
          valor={clientesAtivos ?? 0}
          highlight
        />
        <MetricaCard label="Leads (todos clientes)" valor={totalLeads ?? 0} />
      </div>

      {/* Lista */}
      {!clientes || clientes.length === 0 ? (
        <EmptyState
          icone="🏢"
          titulo="Nenhum cliente cadastrado"
          descricao="Cadastre o primeiro cliente. O sistema vai provisionar tudo automaticamente: workspace, Evolution, Chatwoot e cobrança Asaas."
          acao={{
            label: "Cadastrar primeiro cliente",
            href: "/admin/clientes/novo",
          }}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-cinza-claro overflow-hidden">
          <table className="w-full">
            <thead className="bg-offwhite border-b border-cinza-claro">
              <tr>
                <Th>Empresa</Th>
                <Th>Contato</Th>
                <Th>Plano</Th>
                <Th>Status</Th>
                <Th>Cadastrado</Th>
                <Th className="text-right">Ações</Th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-cinza-claro last:border-0 hover:bg-offwhite/50 transition"
                >
                  <Td>
                    <p className="font-heading font-semibold text-preto">
                      {c.name}
                    </p>
                  </Td>
                  <Td>
                    <div>
                      <p className="text-sm text-preto">{c.email_contato}</p>
                      {c.whatsapp_numero && (
                        <p className="text-xs text-cinza-medio font-mono mt-0.5">
                          {c.whatsapp_numero}
                        </p>
                      )}
                    </div>
                  </Td>
                  <Td>
                    <PlanoLabel plano={c.plano} />
                  </Td>
                  <Td>
                    <StatusCliente ativo={c.ativo} inadimplente={c.inadimplente} />
                  </Td>
                  <Td>
                    <span className="text-sm text-cinza-medio">
                      {new Date(c.created_at).toLocaleDateString("pt-BR")}
                    </span>
                  </Td>
                  <Td className="text-right">
                    <Link
                      href={`/admin/clientes/${c.id}`}
                      className="text-sm text-laranja hover:text-laranja-escuro font-heading font-semibold"
                    >
                      Gerenciar →
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

function MetricaCard({
  label,
  valor,
  highlight = false,
}: {
  label: string;
  valor: number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`bg-white rounded-2xl border p-5 ${
        highlight ? "border-laranja" : "border-cinza-claro"
      }`}
    >
      <p className="text-xs font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1">
        {label}
      </p>
      <p
        className={`text-3xl font-heading font-bold ${
          highlight ? "text-laranja" : "text-preto"
        }`}
      >
        {valor}
      </p>
    </div>
  );
}

function PlanoLabel({ plano }: { plano: string }) {
  const labels: Record<string, string> = {
    mensal_basico: "Básico",
    mensal_pro: "Pro",
    mensal_enterprise: "Enterprise",
  };

  return (
    <span className="text-sm text-preto font-heading font-medium">
      {labels[plano] ?? plano}
    </span>
  );
}

function StatusCliente({
  ativo,
  inadimplente,
}: {
  ativo: boolean;
  inadimplente: boolean;
}) {
  if (inadimplente) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-heading font-semibold bg-red-50 text-red-700 border border-red-200">
        <span className="w-1.5 h-1.5 rounded-full bg-red-700" />
        Inadimplente
      </span>
    );
  }
  if (!ativo) {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-heading font-semibold bg-cinza-claro text-cinza-medio border border-cinza-claro">
        Pausado
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-heading font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-700" />
      Ativo
    </span>
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
