-- ============================================================
-- Migração: auditoria de mudanças manuais de status + avaliação
-- rápida de sessão (Consultoria Técnica).
-- Roda isso no SQL Editor do Supabase (depois das migrações
-- anteriores, incluindo a de auth-profiles).
-- ============================================================

-- ---------- Auditoria: quem mudou o status de um check-in e quando ----------
create table if not exists checkin_audit (
  id serial primary key,
  checkin_id int not null references checkins(id) on delete cascade,
  actor_id uuid references profiles(id),
  actor_name text not null,
  from_status text,
  to_status text not null,
  created_at timestamptz not null default now()
);

alter table checkin_audit enable row level security;
drop policy if exists "leitura da equipe" on checkin_audit;
create policy "leitura da equipe" on checkin_audit for select using (auth.uid() is not null);

-- Única forma de gravar no log: passando pela função abaixo (grava o
-- ator automaticamente, sem precisar confiar no que o cliente manda).
create or replace function staff_set_checkin_status(p_checkin_id int, p_status text)
returns void
language plpgsql
security definer
as $$
declare
  actor profiles%rowtype;
  prev text;
begin
  if p_status not in ('waitlisted','confirmed','checked_in','no_show','cancelled') then
    raise exception 'status inválido: %', p_status;
  end if;

  select * into actor from profiles where id = auth.uid();
  if not found then
    raise exception 'apenas usuários autenticados podem alterar status.';
  end if;

  select status into prev from checkins where id = p_checkin_id for update;
  if not found then
    raise exception 'inscrição não encontrada.';
  end if;

  update checkins
    set status = p_status,
        checked_in_at = case when p_status = 'checked_in' then now() else checked_in_at end
    where id = p_checkin_id;

  insert into checkin_audit (checkin_id, actor_id, actor_name, from_status, to_status)
    values (p_checkin_id, actor.id, actor.name, prev, p_status);
end;
$$;

grant execute on function staff_set_checkin_status(int, text) to authenticated;

-- ---------- Avaliação rápida de sessão (1 toque, 1 a 5) ----------
create table if not exists session_feedback (
  id serial primary key,
  session_id int not null references sessions(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  created_at timestamptz not null default now()
);

alter table session_feedback enable row level security;
drop policy if exists "acesso da equipe" on session_feedback;
create policy "acesso da equipe" on session_feedback for all
  using (auth.uid() is not null) with check (auth.uid() is not null);

grant select, insert on session_feedback to authenticated;

-- ---------- Tempo real ----------
alter publication supabase_realtime add table checkin_audit, session_feedback;
