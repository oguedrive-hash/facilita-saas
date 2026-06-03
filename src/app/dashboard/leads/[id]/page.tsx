import { redirect } from "next/navigation";

/**
 * URL antiga /dashboard/leads/{id} redireciona pra /dashboard/contatos/{id}.
 * Mantida pra nao quebrar bookmarks e links antigos.
 */
export default async function LeadDetalheRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const target = from
    ? `/dashboard/contatos/${id}?from=${from}`
    : `/dashboard/contatos/${id}`;
  redirect(target);
}
