-- ============================================================
-- Migração: restringe quem pode mandar quem pro almoço.
--
-- Antes: qualquer admin (comercial ou técnica) podia mandar
-- QUALQUER pessoa da equipe pro almoço, misturando times.
--
-- Agora: admin comercial só manda gente do time "Comercial".
-- Admin técnica manda gente do time "Técnica" OU "Caixa" (o Caixa
-- fica sob responsabilidade da Técnica). A checagem é feita dentro
-- da própria função (não só escondida no front), pra não dar pra
-- burlar chamando a RPC direto.
--
-- Também adiciona "Caixa" como time válido em `staff` (antes só
-- existia Comercial/Técnica) — sem isso não dá nem pra cadastrar
-- alguém do Caixa na equipe.
--
-- Roda isso no SQL Editor do Supabase (depois de restaura-almoco.sql).
-- ============================================================

alter table staff drop constraint if exists staff_team_check;
alter table staff add constraint staff_team_check
  check (team in ('Comercial', 'Técnica', 'Caixa'));

create or replace function enter_lunch_queue_group(p_staff_ids int[])
returns void
language plpgsql
security definer
as $$
declare
  sid int;
  caller_dept text;
  caller_level text;
  s_team text;
begin
  select department, level into caller_dept, caller_level from profiles where id = auth.uid();

  if caller_level is distinct from 'admin' or caller_dept not in ('comercial', 'tecnica') then
    raise exception 'Sem permissão pra mandar gente pro almoço.';
  end if;

  if array_length(p_staff_ids, 1) is null or array_length(p_staff_ids, 1) > 2 then
    raise exception 'Escolha 1 ou 2 pessoas por vez.';
  end if;

  foreach sid in array p_staff_ids loop
    select team into s_team from staff where id = sid;
    if s_team is null then
      raise exception 'Pessoa % não encontrada na equipe.', sid;
    end if;
    if caller_dept = 'comercial' and s_team <> 'Comercial' then
      raise exception 'Admin comercial só pode mandar gente do Comercial pro almoço.';
    end if;
    if caller_dept = 'tecnica' and s_team not in ('Técnica', 'Caixa') then
      raise exception 'Admin técnica só pode mandar gente da Técnica ou do Caixa pro almoço.';
    end if;

    update staff set status = 'queued' where id = sid and status = 'pending';
    if found then
      insert into lunch_queue (staff_id) values (sid);
    end if;
  end loop;

  perform try_fill_copa();
end;
$$;
