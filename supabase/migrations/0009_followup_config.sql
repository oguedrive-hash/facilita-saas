-- ============================================
-- Cadência de follow-up — config por cliente (organization)
-- ============================================
-- Regras sequenciais: cada nivel dispara N tempo depois do anterior.
-- Quando lead responde, zera o ciclo e reinicia status pra em_conversa.
-- Quando esgota regras, vira "perdido" (ou tenta reativacao depois X dias).

alter table organizations
  add column if not exists followup_config jsonb default '{
    "regras": [
      {
        "nivel": 1,
        "esperar_dias": 0,
        "esperar_horas": 4,
        "mensagem": "Oi {nome}, tudo bem? Ainda por aí?",
        "usa_ia": false,
        "ativo": true
      },
      {
        "nivel": 2,
        "esperar_dias": 1,
        "esperar_horas": 0,
        "mensagem": "{nome}, lembrei de você. Posso te ajudar com mais alguma coisa?",
        "usa_ia": true,
        "ativo": true
      },
      {
        "nivel": 3,
        "esperar_dias": 2,
        "esperar_horas": 0,
        "mensagem": "{nome}, vou parar de tentar por aqui. Se mudar de ideia, é só me chamar!",
        "usa_ia": false,
        "ativo": true
      }
    ],
    "reativacao": {
      "ativa": false,
      "esperar_dias": 30,
      "mensagem": "Oi {nome}, ainda buscando soluções nessa área? Posso atualizar você com as novidades.",
      "usa_ia": true
    }
  }'::jsonb;

alter table leads
  add column if not exists ultimo_followup_em timestamptz,
  add column if not exists ultima_msg_lead_em timestamptz;

-- Index pra worker buscar quem precisa de followup eficiente
create index if not exists idx_leads_proximo_followup_ativo
  on leads (proximo_followup_em)
  where caio_ativo = true and proximo_followup_em is not null;
