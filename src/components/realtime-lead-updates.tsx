"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Subscribe via Supabase Realtime em mudancas do lead atual:
 *  - INSERT/UPDATE em mensagens com lead_id = X (mensagem nova ou status muda)
 *  - UPDATE em leads com id = X (status, caio_ativo, resumo, notas)
 *
 * Quando qualquer evento chega, dispara router.refresh() pra re-renderizar
 * o Server Component com dados frescos. Substitui o AutoRefresh por polling.
 */
export function RealtimeLeadUpdates({ leadId }: { leadId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    // Propaga JWT do user autenticado pro Realtime — sem isso o canal
    // conecta como anon e a RLS bloqueia os eventos (is_admin() = false).
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
        .channel(`lead-${leadId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "mensagens",
            filter: `lead_id=eq.${leadId}`,
          },
          () => router.refresh(),
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "leads",
            filter: `id=eq.${leadId}`,
          },
          () => router.refresh(),
        )
        .subscribe();
    })();

    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, [leadId, router]);

  return null;
}
