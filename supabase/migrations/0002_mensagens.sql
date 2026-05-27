-- ============================================
-- FACILITA SAAS — Mensagens espelhadas do Chatwoot
-- ============================================

create table mensagens (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  lead_id uuid references leads(id) on delete cascade not null,

  -- IDs no Chatwoot (pra dedup e referência cruzada)
  chatwoot_message_id bigint,
  chatwoot_conversation_id int,

  -- Conteúdo
  conteudo text,
  tipo text default 'texto' check (tipo in ('texto', 'audio', 'imagem', 'arquivo', 'video')),
  attachment_url text,

  -- 'entrada' = lead mandou; 'saida' = bot/atendente mandou
  direcao text not null check (direcao in ('entrada', 'saida')),

  remetente_nome text,
  privada boolean default false,

  created_at timestamptz default now(),

  unique (chatwoot_message_id)
);

create index idx_mensagens_lead_created on mensagens(lead_id, created_at desc);
create index idx_mensagens_organization on mensagens(organization_id);
create index idx_mensagens_conversation
  on mensagens(chatwoot_conversation_id)
  where chatwoot_conversation_id is not null;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

alter table mensagens enable row level security;

create policy "Vê mensagens da própria org ou admin"
  on mensagens for select
  using (organization_id = get_user_organization_id() or is_admin());

create policy "Apenas admin cria mensagens via UI"
  on mensagens for insert
  with check (is_admin());

-- Service role (server-side) bypassa RLS automaticamente.
