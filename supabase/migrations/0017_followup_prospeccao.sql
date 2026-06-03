-- Cadencia de follow-up especifica pra leads de prospeccao.
-- Quando um lead de prospeccao responde e depois some, o tom da retomada
-- e diferente do follow-up inbound (la o lead procurou a gente; aqui nos
-- procuramos ele). Por isso config separada.
alter table organizations
  add column if not exists prospeccao_followup_config jsonb
    not null default '{"regras":[]}'::jsonb;
