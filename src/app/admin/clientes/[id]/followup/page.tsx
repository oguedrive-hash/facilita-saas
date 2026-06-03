import { redirect } from "next/navigation";

export default async function FollowupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/admin/clientes/${id}/followup/cadencia`);
}
