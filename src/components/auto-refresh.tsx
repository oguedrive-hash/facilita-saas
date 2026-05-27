"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Cliente component que dispara router.refresh() periodicamente.
 * Refaz o fetch de dados server-side da página atual sem reload completo.
 *
 * Usado na página do lead pra trazer mensagens novas que chegam via webhook
 * enquanto o usuário tá olhando a conversa.
 */
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(interval);
  }, [router, intervalMs]);

  return null;
}
