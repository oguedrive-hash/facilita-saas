-- ============================================
-- DADOS DE TESTE — só pra ver as páginas populadas
-- ============================================
-- Execute no Supabase SQL Editor pra preencher leads/agendamentos de exemplo
-- ATENÇÃO: assume que a organization "Facilita" já existe (criada no setup inicial)

-- Pega o ID da organization Facilita
DO $$
DECLARE
  v_org_id uuid;
  v_lead1 uuid;
  v_lead2 uuid;
  v_lead3 uuid;
  v_lead4 uuid;
  v_lead5 uuid;
BEGIN
  -- Encontra a org
  SELECT id INTO v_org_id FROM organizations WHERE name = 'Facilita' LIMIT 1;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization "Facilita" não encontrada. Execute o setup inicial primeiro.';
  END IF;

  -- Insere leads variados
  INSERT INTO leads (organization_id, telefone, nome, status, source, created_at, updated_at)
  VALUES
    (v_org_id, '+5511988887777', 'João Silva', 'em_conversa', 'whatsapp', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '15 minutes'),
    (v_org_id, '+5511977776666', 'Maria Santos', 'reuniao_agendada', 'whatsapp', NOW() - INTERVAL '1 day', NOW() - INTERVAL '3 hours'),
    (v_org_id, '+5511966665555', 'Pedro Costa', 'followup', 'whatsapp', NOW() - INTERVAL '3 days', NOW() - INTERVAL '1 day'),
    (v_org_id, '+5511955554444', 'Ana Oliveira', 'novo_lead', 'whatsapp', NOW() - INTERVAL '10 minutes', NOW() - INTERVAL '10 minutes'),
    (v_org_id, '+5511944443333', 'Carlos Mendes', 'perdido', 'whatsapp', NOW() - INTERVAL '15 days', NOW() - INTERVAL '7 days')
  RETURNING id INTO v_lead1;

  -- Pega IDs (precisamos pra agendamentos)
  SELECT id INTO v_lead2 FROM leads WHERE telefone = '+5511977776666' AND organization_id = v_org_id;

  -- Atualiza algumas razões pra leads em estado específico
  UPDATE leads SET razao = 'Lead pediu pra retornar daqui 2 semanas'
    WHERE telefone = '+5511966665555' AND organization_id = v_org_id;

  UPDATE leads SET razao = 'Não respondeu após 3 tentativas. Pode reativar depois.'
    WHERE telefone = '+5511944443333' AND organization_id = v_org_id;

  -- Insere agendamento futuro (vinculado ao Maria Santos)
  INSERT INTO agendamentos (organization_id, lead_id, data_inicio, data_fim, status, meet_link, observacoes)
  VALUES
    (
      v_org_id,
      v_lead2,
      NOW() + INTERVAL '2 days',
      NOW() + INTERVAL '2 days' + INTERVAL '30 minutes',
      'agendado',
      'https://meet.google.com/abc-defg-hij',
      'Cliente quer entender automação de atendimento'
    );

  RAISE NOTICE 'Dados de teste inseridos com sucesso!';
END $$;

-- Verifica resultado
SELECT
  l.nome,
  l.telefone,
  l.status,
  COUNT(a.id) as agendamentos
FROM leads l
LEFT JOIN agendamentos a ON a.lead_id = l.id
WHERE l.organization_id = (SELECT id FROM organizations WHERE name = 'Facilita')
GROUP BY l.id, l.nome, l.telefone, l.status, l.updated_at
ORDER BY l.updated_at DESC;
