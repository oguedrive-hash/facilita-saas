import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Periodo = "todos" | "hoje" | "7d" | "30d";

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

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  // Escape CSV: aspas duplas e vírgula precisam de quoting
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const sp = request.nextUrl.searchParams;
  const statusFilter = sp.get("status") ?? "todos";
  const caioFilter = sp.get("caio") ?? "todos";
  const searchQuery = sp.get("q") ?? "";
  const periodo = (sp.get("periodo") ?? "todos") as Periodo;
  const de = sp.get("de") ?? "";
  const ate = sp.get("ate") ?? "";
  const sortField = sp.get("sort") ?? "updated_at";
  const sortOrder = (sp.get("order") ?? "desc") === "asc";

  let query = supabase
    .from("leads")
    .select(
      "id, nome, telefone, status, source, caio_ativo, numero_followup, razao, created_at, updated_at",
    )
    .order(sortField, { ascending: sortOrder })
    .limit(5000); // limite de segurança

  if (statusFilter !== "todos") query = query.eq("status", statusFilter);
  if (caioFilter === "on") query = query.eq("caio_ativo", true);
  if (caioFilter === "off") query = query.eq("caio_ativo", false);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().replace(/[%_]/g, "");
    query = query.or(`nome.ilike.%${q}%,telefone.ilike.%${q}%`);
  }
  if (de) {
    query = query.gte("created_at", new Date(de).toISOString());
  } else {
    const desde = calcularDesde(periodo);
    if (desde) query = query.gte("created_at", desde);
  }
  if (ate) {
    const ateData = new Date(ate);
    ateData.setHours(23, 59, 59, 999);
    query = query.lte("created_at", ateData.toISOString());
  }

  const { data: leads, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const headers = [
    "id",
    "nome",
    "telefone",
    "status",
    "origem",
    "caio_ativo",
    "followups_enviados",
    "razao",
    "criado_em",
    "ultima_atividade",
  ];
  const linhas = (leads ?? []).map((l) =>
    [
      l.id,
      l.nome ?? "",
      l.telefone,
      l.status,
      l.source,
      l.caio_ativo ? "sim" : "nao",
      l.numero_followup ?? 0,
      l.razao ?? "",
      new Date(l.created_at).toISOString(),
      new Date(l.updated_at).toISOString(),
    ]
      .map(csvCell)
      .join(","),
  );

  const csv = [headers.join(","), ...linhas].join("\n");
  const filename = `leads-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
