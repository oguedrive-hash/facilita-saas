-- ============================================
-- Log de eventos do lead (audit log)
-- ============================================
-- Registra mudancas importantes: status, caio_ativo, followup_ativo,
-- mensagens enviadas pelo painel, follow-ups disparados, lembretes, etc.
-- Mostrado como timeline no detalhe do lead.

create table if not exists lead_eventos (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  organization_id uuid not null references organizations(id) on delete cascade,
  tipo text not null,
  descricao text not null,
  autor_id uuid references auth.users(id) on delete set null,
  autor_nome text,
  meta jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_lead_eventos_lead on lead_eventos (lead_id, created_at desc);

-- RLS
alter table lead_eventos enable row level security;

create policy "ve eventos da propria org ou admin"
  on lead_eventos for select
  using ((organization_id = get_user_organization_id()) or is_admin());

-- Insert so via service_role (admin client) — actions registram
create policy "admin pode inserir"
  on lead_eventos for insert
  with check (is_admin());
