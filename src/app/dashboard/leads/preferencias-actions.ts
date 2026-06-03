"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setViewPreferida(
  view: "lista" | "kanban",
  opts?: { cookieName?: string; pathRevalidate?: string },
) {
  const cookieName = opts?.cookieName ?? "lead_view_preferida";
  const pathRevalidate = opts?.pathRevalidate ?? "/dashboard/leads";
  const c = await cookies();
  c.set(cookieName, view, {
    httpOnly: false, // pode ser lido pelo client se quiser
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 ano
  });
  revalidatePath(pathRevalidate);
}
