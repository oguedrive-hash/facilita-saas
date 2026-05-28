"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setViewPreferida(view: "lista" | "kanban") {
  const c = await cookies();
  c.set("lead_view_preferida", view, {
    httpOnly: false, // pode ser lido pelo client se quiser
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 ano
  });
  revalidatePath("/dashboard/leads");
}
