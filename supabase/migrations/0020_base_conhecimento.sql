-- Separa "como o Caio se comporta" de "o que o Caio sabe".
--
-- Comportamento ja existia em duas variantes:
--   prompt_system              → como Caio age no inbound
--   prompt_system_prospeccao   → como Caio age na prospeccao
--
-- A base de conhecimento (sobre a empresa, produtos, precos, FAQs, etc.)
-- agora fica num campo proprio, compartilhado pelos dois modos.
alter table organizations
  add column if not exists base_conhecimento text;
