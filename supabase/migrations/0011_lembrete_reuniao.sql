-- ============================================
-- Lembretes de reuniao agendada
-- ============================================
-- Cada regra dispara N tempo ANTES ou DEPOIS do data_inicio do agendamento.
-- Ex: "1 dia 0h 0min antes", "30min antes", "10min depois" (no-show check).

alter table organizations
  add column if not exists lembrete_reuniao_config jsonb default '{
    "regras": [
      {
        "nivel": 1,
        "quando": "antes",
        "tempo_dias": 1,
        "tempo_horas": 0,
        "tempo_minutos": 0,
        "mensagem": "Oi {nome}! Lembrete: nossa reunião é amanhã às {hora}. Pode confirmar?",
        "usa_ia": false,
        "ativo": true
      },
      {
        "nivel": 2,
        "quando": "antes",
        "tempo_dias": 0,
        "tempo_horas": 0,
        "tempo_minutos": 30,
        "mensagem": "Oi {nome}, nossa reunião começa em 30 minutos! Link: {meet_link}",
        "usa_ia": false,
        "ativo": true
      }
    ]
  }'::jsonb;

-- Tracking de quais niveis ja foram enviados pra cada agendamento
alter table agendamentos
  add column if not exists lembretes_enviados int[] default '{}';

-- Index pro worker buscar agendamentos pendentes eficiente
create index if not exists idx_agendamentos_pendentes
  on agendamentos (data_inicio, status)
  where status = 'agendado';
