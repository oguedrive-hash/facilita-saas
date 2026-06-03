-- Resolve o problema de leads duplicados pelo mesmo telefone numa org.
-- Antes a gente permitia varios leads com mesmo numero (formatado diferente),
-- e isso bagunca o Chatwoot (mesma conversa, mensagens roteadas pro lead errado).
--
-- Etapas:
--  1. Adiciona origem_inicial (snapshot imutavel da origem com que o lead
--     entrou — origem em si vira mutavel pra refletir o fluxo atual).
--  2. Adiciona telefone_digitos (so digitos do telefone) e trigger pra
--     manter sincronizado.
--  3. Mergeia duplicatas existentes — mantem o lead mais antigo, move
--     lead_eventos, mensagens e agendamentos pra ele, deleta os outros.
--  4. Cria unique index (organization_id, telefone_digitos) — futuras
--     tentativas de duplicar falham no banco direto.

-- ====== 1. origem_inicial ======
alter table leads add column if not exists origem_inicial text;
update leads set origem_inicial = origem where origem_inicial is null;
alter table leads alter column origem_inicial set not null;
alter table leads alter column origem_inicial set default 'inbound';

-- ====== 2. telefone_digitos + trigger ======
alter table leads add column if not exists telefone_digitos text;
update leads
  set telefone_digitos = regexp_replace(coalesce(telefone, ''), '\D', '', 'g')
  where telefone_digitos is null;
alter table leads alter column telefone_digitos set not null;
alter table leads alter column telefone_digitos set default '';

create or replace function set_telefone_digitos() returns trigger as $$
begin
  new.telefone_digitos := regexp_replace(coalesce(new.telefone, ''), '\D', '', 'g');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_telefone_digitos on leads;
create trigger trg_set_telefone_digitos
  before insert or update of telefone on leads
  for each row execute function set_telefone_digitos();

-- ====== 3. Merge duplicatas ======
do $$
declare
  grupo record;
  manter_id uuid;
  mais_recente_origem text;
  mais_recente_status text;
  max_prosp int;
  max_followup int;
  max_reat int;
  novo_dados jsonb;
  chatwoot_id_keep int;
begin
  for grupo in
    select organization_id, telefone_digitos
    from leads
    where telefone_digitos != ''
    group by organization_id, telefone_digitos
    having count(*) > 1
  loop
    -- mais antigo (mantido)
    select id into manter_id
    from leads
    where organization_id = grupo.organization_id
      and telefone_digitos = grupo.telefone_digitos
    order by created_at asc
    limit 1;

    -- origem/status do mais recente (reflete fluxo atual)
    select origem, status
      into mais_recente_origem, mais_recente_status
    from leads
    where organization_id = grupo.organization_id
      and telefone_digitos = grupo.telefone_digitos
    order by created_at desc
    limit 1;

    -- max dos contadores
    select max(coalesce(numero_prospeccao, 0)),
           max(coalesce(numero_followup, 0)),
           max(coalesce(numero_reativacao, 0))
      into max_prosp, max_followup, max_reat
    from leads
    where organization_id = grupo.organization_id
      and telefone_digitos = grupo.telefone_digitos;

    -- merge dados_extras: agrupa todas as chaves, mais recente sobrescreve
    select coalesce(jsonb_object_agg(key, val), '{}'::jsonb)
      into novo_dados
    from (
      select kv.key, kv.value as val, l.created_at
      from leads l
      cross join lateral jsonb_each(coalesce(l.dados_extras, '{}'::jsonb)) kv
      where l.organization_id = grupo.organization_id
        and l.telefone_digitos = grupo.telefone_digitos
      order by l.created_at desc
    ) sub;

    -- chatwoot_conversation_id: prefere o do mantido; senao usa primeiro nao-null
    select chatwoot_conversation_id into chatwoot_id_keep
    from leads where id = manter_id;
    if chatwoot_id_keep is null then
      select chatwoot_conversation_id into chatwoot_id_keep
      from leads
      where organization_id = grupo.organization_id
        and telefone_digitos = grupo.telefone_digitos
        and chatwoot_conversation_id is not null
      limit 1;
    end if;

    -- move FKs dos duplicados pro mantido
    update lead_eventos set lead_id = manter_id
    where lead_id in (
      select id from leads
      where organization_id = grupo.organization_id
        and telefone_digitos = grupo.telefone_digitos
        and id != manter_id
    );
    update mensagens set lead_id = manter_id
    where lead_id in (
      select id from leads
      where organization_id = grupo.organization_id
        and telefone_digitos = grupo.telefone_digitos
        and id != manter_id
    );
    update agendamentos set lead_id = manter_id
    where lead_id in (
      select id from leads
      where organization_id = grupo.organization_id
        and telefone_digitos = grupo.telefone_digitos
        and id != manter_id
    );

    -- atualiza o mantido com o estado consolidado
    update leads set
      origem = coalesce(mais_recente_origem, origem),
      status = coalesce(mais_recente_status, status),
      numero_prospeccao = max_prosp,
      numero_followup = max_followup,
      numero_reativacao = max_reat,
      dados_extras = novo_dados,
      chatwoot_conversation_id = chatwoot_id_keep
    where id = manter_id;

    -- deleta os duplicados
    delete from leads
    where organization_id = grupo.organization_id
      and telefone_digitos = grupo.telefone_digitos
      and id != manter_id;

    raise notice 'Mergeado tel % -> %', grupo.telefone_digitos, manter_id;
  end loop;
end $$;

-- ====== 4. Unique constraint ======
create unique index if not exists leads_org_telefone_digitos_uniq
  on leads(organization_id, telefone_digitos)
  where telefone_digitos != '';
