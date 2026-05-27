-- ============================================
-- Shadow messages — respostas geradas por IA no painel
-- que NÃO foram enviadas (só pra comparar com o que o
-- Caio do n8n respondeu na vida real).
-- ============================================

alter table mensagens
  add column if not exists shadow boolean default false not null;

create index if not exists idx_mensagens_shadow
  on mensagens(lead_id, shadow)
  where shadow = true;
