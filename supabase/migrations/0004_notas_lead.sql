-- ============================================
-- Coluna `notas` em leads — observações livres
-- escritas pelo agente humano no painel.
-- ============================================

alter table leads
  add column if not exists notas text;
