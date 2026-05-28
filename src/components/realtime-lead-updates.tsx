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
    console.log("[realtime] mounting, leadId=", leadId);
    const supabase = createClient();
    console.log("[realtime] client created, url=", process.env.NEXT_PUBLIC_SUPABASE_URL);

    const channel = supabase
      .channel(`lead-${leadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mensagens",
          filter: `lead_id=eq.${leadId}`,
        },
        (payload) => {
          console.log("[realtime] mensagem event:", payload.eventType);
          router.refresh();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "leads",
          filter: `id=eq.${leadId}`,
        },
        (payload) => {
          console.log("[realtime] lead event:", payload.eventType);
          router.refresh();
        },
      )
      .subscribe((status, err) => {
        console.log("[realtime] subscribe status:", status, err ?? "");
      });

    return () => {
      console.log("[realtime] unmounting");
      supabase.removeChannel(channel);
    };
  }, [leadId, router]);

  return null;
}
