-- ============================================
-- Adiamento solicitado pelo lead
-- ============================================
-- Quando lead pede pra "chamar outro dia", sistema agenda mensagem de
-- retomada pro dia/hora combinado e move status pra contatar_futuramente.
-- Se o dia chegar e o lead nao responder, reativa cadencia de follow-up.

alter table leads
  add column if not exists aguardando_resposta_adiamento boolean default false,
  add column if not exists proximo_contato_em timestamptz;

create index if not exists idx_leads_proximo_contato
  on leads (proximo_contato_em)
  where proximo_contato_em is not null and caio_ativo = true;

-- Mensagem de retomada (template) por organization
alter table organizations
  add column if not exists mensagem_retomada text default
    'Oi {nome}! Como combinamos, voltando ao contato. Posso te apresentar a Facilita?',
  add column if not exists mensagem_retomada_usa_ia boolean default true;
