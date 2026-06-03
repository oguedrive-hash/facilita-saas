-- ============================================
-- Suporte a midia (texto/audio/imagem/video) em retomada
-- ============================================
-- Lembretes de reuniao e reativacao tem o campo dentro do JSONB
-- (followup_config.reativacao + lembrete_reuniao_config.regras[]).
-- Mensagem de retomada vive em colunas separadas em organizations.

alter table organizations
  add column if not exists mensagem_retomada_tipo_midia text default 'texto',
  add column if not exists mensagem_retomada_attachment_url text,
  add column if not exists mensagem_retomada_attachment_mime text;
