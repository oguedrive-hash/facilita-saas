-- Rastreia em qual regra de reativacao o lead esta. 0 = nao iniciou
-- reativacao (esta em followup principal ou ainda nao desistiu).
alter table leads
  add column if not exists numero_reativacao integer not null default 0;
