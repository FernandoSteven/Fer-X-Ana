begin;

create table if not exists public.pet_answer_history (
    id uuid primary key default gen_random_uuid(),
    question text not null,
    answer text not null,
    answered_on date not null unique,
    created_at timestamptz not null default now(),
    constraint pet_answer_history_question_length_check
        check (char_length(btrim(question)) between 1 and 500),
    constraint pet_answer_history_answer_length_check
        check (char_length(btrim(answer)) between 3 and 500)
);

alter table public.pet_answer_history enable row level security;

revoke all on table public.pet_answer_history from public, anon, authenticated;
grant select, insert on table public.pet_answer_history to anon, authenticated;

drop policy if exists "Anyone can read pet answer history" on public.pet_answer_history;
create policy "Anyone can read pet answer history"
    on public.pet_answer_history
    for select
    to anon, authenticated
    using (true);

drop policy if exists "Anyone can add today's pet answer" on public.pet_answer_history;
create policy "Anyone can add today's pet answer"
    on public.pet_answer_history
    for insert
    to anon, authenticated
    with check (
        answered_on = (now() at time zone 'Pacific/Galapagos')::date
    );

-- Keep the existing shared answer when moving to the full history.
insert into public.pet_answer_history (question, answer, answered_on)
select
    'Pregunta diaria anterior (antes de activar el historial)',
    left(btrim(last_answer), 500),
    last_answered_on
from public.shared_pet
where id = 1
  and last_answered_on is not null
  and char_length(btrim(coalesce(last_answer, ''))) between 3 and 500
on conflict (answered_on) do nothing;

create or replace function public.sync_pet_answer_history_to_shared_pet()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    update public.shared_pet
    set food_count = coalesce(food_count, 0) + 1,
        last_answered_on = new.answered_on,
        last_answer = new.answer
    where id = 1;

    if not found then
        raise exception 'The shared puppy row is missing.';
    end if;

    return new;
end;
$$;

revoke execute on function public.sync_pet_answer_history_to_shared_pet() from public, anon, authenticated;

drop trigger if exists pet_answer_history_sync_shared_pet on public.pet_answer_history;
create trigger pet_answer_history_sync_shared_pet
    after insert on public.pet_answer_history
    for each row
    execute function public.sync_pet_answer_history_to_shared_pet();

commit;
