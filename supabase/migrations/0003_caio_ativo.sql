-- ============================================
-- Coluna `caio_ativo` em leads — espelha a etiqueta `agente-off`
-- do Chatwoot. true = Caio responde, false = humano assumiu.
--
-- Sincronizado pelo webhook handler quando recebe conversation_updated
-- (Chatwoot envia o array `labels[]` no payload).
-- ============================================

alter table leads
  add column if not exists caio_ativo boolean default true not null;

-- Index pra filtrar rápido na listagem
create index if not exists idx_leads_caio_ativo on leads(organization_id, caio_ativo);
