-- Prospecção ativa: leads importados manualmente que o Caio contata primeiro.
-- Diferenciação em relação ao fluxo inbound atual (lead já mandou msg):
--  - lead entra com origem='prospeccao' e status='aguardando_primeiro_contato'
--  - worker dispara mensagens em cadência (regra 1, 2, 3...) respeitando janela
--  - quando lead responder, status vira 'em_conversa' (cai no fluxo padrão)

-- ====== Campos novos em leads ======
alter table leads
  add column if not exists origem text not null default 'inbound'
    check (origem in ('inbound', 'prospeccao')),
  add column if not exists numero_prospeccao integer not null default 0,
  add column if not exists dados_extras jsonb not null default '{}'::jsonb;

create index if not exists idx_leads_origem on leads(origem);
create index if not exists idx_leads_prospeccao_pendente
  on leads(organization_id, proximo_contato_em)
  where origem = 'prospeccao' and proximo_contato_em is not null;

-- ====== Status novos ======
-- Drop+recreate da check constraint pra incluir 'aguardando_primeiro_contato'
-- e 'em_prospeccao'.
alter table leads drop constraint if exists leads_status_check;
alter table leads add constraint leads_status_check check (status in (
  'novo_lead',
  'em_conversa',
  'followup',
  'contatar_futuramente',
  'perdido',
  'reuniao_agendada',
  'fechou',
  'aguardando_primeiro_contato',
  'em_prospeccao'
));

-- ====== Config em organizations ======
alter table organizations
  add column if not exists prospeccao_config jsonb not null default '{"regras":[]}'::jsonb,
  add column if not exists prospeccao_janela jsonb not null default
    '{"dias_semana":[1,2,3,4,5],"hora_inicio":9,"hora_fim":18,"rate_limit_hora":10}'::jsonb;
