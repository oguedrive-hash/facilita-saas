-- ============================================
-- Indicador "Caio está digitando..." no chat
-- ============================================
-- O webhook seta caio_processing_since = now() antes de gerar resposta
-- e null depois de enviar. A UI mostra o indicador enquanto for non-null
-- e mais novo que 60s (proteção contra processos travados).

alter table leads add column if not exists caio_processing_since timestamptz;
