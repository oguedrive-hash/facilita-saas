-- ============================================
-- Follow-up: toggle por lead + qual regra dispara mudanca de status
-- ============================================

-- Toggle por lead. Quando false, worker ignora esse lead mesmo se proximo_followup_em vencer.
alter table leads add column if not exists followup_ativo boolean default true;

-- A partir de qual regra o lead vira status "followup" (default: regra 1 — comportamento atual).
-- Ex: se = 2, regras 1 mantem status atual ("em_conversa", "novo_lead"), so a regra 2 muda pra "followup".
alter table organizations add column if not exists followup_mudar_status_a_partir int default 1;
