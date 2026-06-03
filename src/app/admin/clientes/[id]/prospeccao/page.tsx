import { redirect } from "next/navigation";

export default async function ProspeccaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/clientes/${id}/prospeccao/cadencia`);
}
