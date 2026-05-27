-- ============================================
-- FACILITA SAAS — Schema inicial multi-tenant
-- ============================================

-- 1. Organizations (clientes da Facilita Pré-vendedor)
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email_contato text not null,
  whatsapp_numero text,

  -- Config do agente IA (admin define)
  prompt_system text,
  voice_id text default 'pNInz6obpgDQGcFmaJgB',
  voice_settings jsonb default '{
    "stability": 0.25,
    "similarity_boost": 0.9,
    "style": 0.75,
    "speed": 1.05,
    "use_speaker_boost": true
  }'::jsonb,

  -- Status do cliente
  ativo boolean default true,
  inadimplente boolean default false,

  -- IDs em sistemas externos (provisionamento)
  asaas_customer_id text,
  asaas_subscription_id text,
  evolution_instance_name text,
  chatwoot_inbox_id int,

  -- Plano
  plano text default 'mensal_basico' check (
    plano in ('mensal_basico', 'mensal_pro', 'mensal_enterprise')
  ),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Profiles (extends auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  organization_id uuid references organizations(id) on delete cascade,
  nome text,
  role text default 'client' check (role in ('admin', 'client')),
  created_at timestamptz default now()
);

-- 3. Leads (vindos do WhatsApp via Caio)
create table leads (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  telefone text not null,
  nome text,

  status text default 'novo_lead' check (status in (
    'novo_lead',
    'em_conversa',
    'followup',
    'contatar_futuramente',
    'perdido',
    'reuniao_agendada',
    'fechou'
  )),

  source text default 'whatsapp',

  -- Follow-up tracking
  numero_followup int default 0,
  proximo_followup_em timestamptz,
  razao text,

  -- ID em sistemas externos
  chatwoot_conversation_id int,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique (organization_id, telefone)
);

-- 4. Agendamentos
create table agendamentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  lead_id uuid references leads(id) on delete cascade not null,

  data_inicio timestamptz not null,
  data_fim timestamptz not null,

  -- IDs em sistemas externos
  google_event_id text,
  meet_link text,

  status text default 'agendado' check (status in (
    'agendado',
    'realizado',
    'no_show',
    'cancelado'
  )),

  observacoes text,
  created_at timestamptz default now()
);

-- ============================================
-- ÍNDICES
-- ============================================

create index idx_profiles_organization on profiles(organization_id);
create index idx_leads_organization on leads(organization_id);
create index idx_leads_telefone on leads(telefone);
create index idx_leads_status on leads(status);
create index idx_leads_proximo_followup on leads(proximo_followup_em)
  where proximo_followup_em is not null;
create index idx_agendamentos_organization on agendamentos(organization_id);
create index idx_agendamentos_data_inicio on agendamentos(data_inicio);

-- ============================================
-- TRIGGERS — atualizar updated_at automaticamente
-- ============================================

create or replace function update_updated_at_column()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_organizations_updated_at
  before update on organizations
  for each row execute function update_updated_at_column();

create trigger trg_leads_updated_at
  before update on leads
  for each row execute function update_updated_at_column();

-- ============================================
-- FUNÇÕES HELPER (usadas pelas policies de RLS)
-- ============================================

-- Pega organization_id do user logado
create or replace function get_user_organization_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select organization_id from profiles where id = auth.uid();
$$;

-- Verifica se user logado é admin (gerente da Facilita)
create or replace function is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================
-- ROW LEVEL SECURITY (Multi-tenant)
-- ============================================

alter table organizations enable row level security;
alter table profiles enable row level security;
alter table leads enable row level security;
alter table agendamentos enable row level security;

-- Policies: profiles
create policy "Profile próprio ou admin vê tudo"
  on profiles for select
  using (id = auth.uid() or is_admin());

create policy "Próprio profile pode atualizar"
  on profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "Admin cria profiles"
  on profiles for insert
  with check (is_admin());

-- Policies: organizations
create policy "Vê própria organization ou admin tudo"
  on organizations for select
  using (id = get_user_organization_id() or is_admin());

create policy "Apenas admin atualiza organization"
  on organizations for update
  using (is_admin());

create policy "Apenas admin cria organization"
  on organizations for insert
  with check (is_admin());

-- Policies: leads
create policy "Vê leads da própria org ou admin tudo"
  on leads for select
  using (organization_id = get_user_organization_id() or is_admin());

create policy "Atualiza leads da própria org"
  on leads for update
  using (organization_id = get_user_organization_id() or is_admin());

create policy "Cria leads na própria org"
  on leads for insert
  with check (organization_id = get_user_organization_id() or is_admin());

create policy "Deleta leads da própria org"
  on leads for delete
  using (organization_id = get_user_organization_id() or is_admin());

-- Policies: agendamentos
create policy "Vê agendamentos da própria org ou admin tudo"
  on agendamentos for select
  using (organization_id = get_user_organization_id() or is_admin());

create policy "Atualiza agendamentos da própria org"
  on agendamentos for update
  using (organization_id = get_user_organization_id() or is_admin());

create policy "Cria agendamentos na própria org"
  on agendamentos for insert
  with check (organization_id = get_user_organization_id() or is_admin());

-- ============================================
-- AUTO-CRIAR PROFILE QUANDO USUÁRIO SE CADASTRA
-- ============================================

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, nome, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', new.email),
    'client'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
