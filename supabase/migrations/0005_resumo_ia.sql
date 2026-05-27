-- ============================================
-- Resumo gerado por IA (OpenAI) sobre cada lead.
-- ============================================

alter table leads
  add column if not exists resumo_ia text,
  add column if not exists resumo_gerado_em timestamptz;
