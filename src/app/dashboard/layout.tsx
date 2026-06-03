import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/app/login/actions";
import { Logo } from "@/components/logo";
import { NavLink } from "@/components/nav-link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("nome, role, organization_id, organizations(name)")
    .eq("id", user.id)
    .single();

  type OrgRef = { name?: string } | { name?: string }[] | null;
  const orgRef = profile?.organizations as OrgRef;
  const orgName = Array.isArray(orgRef) ? orgRef[0]?.name : orgRef?.name;

  return (
    <div className="min-h-screen bg-offwhite">
      {/* Header */}
      <header className="bg-white border-b border-cinza-claro sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link href="/dashboard">
              <Logo />
            </Link>
            <nav className="hidden md:flex items-center gap-7">
              <NavLink href="/dashboard" exact>
                Dashboard
              </NavLink>
              <NavLink href="/dashboard/contatos">Contatos</NavLink>
              <NavLink href="/dashboard/leads">Inbound</NavLink>
              <NavLink href="/dashboard/prospeccao">Prospecção</NavLink>
              <NavLink href="/dashboard/agenda">Agenda</NavLink>
              {profile?.role === "admin" && (
                <NavLink href="/admin" variant="admin">
                  Admin
                </NavLink>
              )}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm font-heading font-semibold text-preto">
                {profile?.nome ?? user.email}
              </p>
              <p className="text-xs text-cinza-medio">
                {orgName ?? (profile?.role === "admin" ? "Administrador" : "Sem organização")}
              </p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                className="text-sm text-cinza-medio hover:text-laranja font-heading font-medium transition"
              >
                Sair
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
