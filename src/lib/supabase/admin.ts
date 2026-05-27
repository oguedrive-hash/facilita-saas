import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com Service Role (admin total).
 *
 * USAR APENAS EM:
 * - API routes (server-side)
 * - Workers (server-side)
 *
 * NUNCA EXPOR NO FRONTEND. Esse cliente bypassa Row Level Security.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL não está definida");
  }
  if (!serviceKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não está definida. Adiciona no .env.local e nas variáveis de ambiente da Vercel.",
    );
  }

  return createSupabaseClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
