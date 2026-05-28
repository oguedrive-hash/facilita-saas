-- ============================================
-- Debounce de resposta do Caio (mensagens empelotadas)
-- ============================================
-- Quando o lead manda varias msgs em sequencia ("oi", "tudo bem?", "queria
-- saber..."), o Caio espera ele parar de digitar antes de responder UMA
-- vez ao conjunto, em vez de 3 respostas separadas.
--
-- Mecanica: cada msg incoming seta caio_responder_em = now() + DEBOUNCE.
-- Um setTimeout do mesmo tamanho aguarda e re-le o banco. Se outra msg
-- reagendou (valor mudou), desiste. Se nao, processa.
--
-- caio_debounce_segundos por organization permite cada cliente customizar
-- (default: 6s).

alter table leads add column if not exists caio_responder_em timestamptz;

alter table organizations
  add column if not exists caio_debounce_segundos integer default 6;
