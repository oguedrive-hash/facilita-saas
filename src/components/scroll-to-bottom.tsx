"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Wrapper client-side que faz scrollTop = scrollHeight quando `trigger` muda.
 * Usado pra fazer o chat acompanhar mensagens novas chegando via Realtime.
 *
 * Mantém os filhos como Server Components — assim podemos passar componentes
 * que usam toLocaleString/Date sem causar hydration mismatch.
 */
export function ScrollToBottom({
  trigger,
  className = "",
  children,
}: {
  trigger: string | number;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [trigger]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
