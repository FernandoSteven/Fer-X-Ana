begin;

-- Each daily prompt can have two separate replies, and there are five prompts per day.
alter table public.pet_answer_history
    add column if not exists question_index smallint not null default 1,
    add column if not exists response_index smallint not null default 1,
    add column if not exists responder_name text not null default 'Anónimo';

alter table public.pet_answer_history
    drop constraint if exists pet_answer_history_answered_on_key,
    drop constraint if exists pet_answer_history_question_index_check,
    drop constraint if exists pet_answer_history_response_index_check,
    drop constraint if exists pet_answer_history_responder_name_check,
    drop constraint if exists pet_answer_history_daily_slot_key;

alter table public.pet_answer_history
    add constraint pet_answer_history_question_index_check
        check (question_index between 1 and 5),
    add constraint pet_answer_history_response_index_check
        check (response_index between 1 and 2),
    add constraint pet_answer_history_responder_name_check
        check (char_length(btrim(responder_name)) between 1 and 40),
    add constraint pet_answer_history_daily_slot_key
        unique (answered_on, question_index, response_index);

create index if not exists pet_answer_history_daily_order_idx
    on public.pet_answer_history (answered_on desc, question_index asc, response_index asc);

-- Keep shared_pet.outfit in sync with the eight selectable outfits on the page.
alter table public.shared_pet
    drop constraint if exists shared_pet_outfit_check;

alter table public.shared_pet
    add constraint shared_pet_outfit_check
        check (outfit in ('none', 'collar', 'sweater', 'bow', 'pajamas', 'bee', 'raincoat', 'crown', 'six-seven'));

create or replace function public.validate_pet_answer_history_slot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    if new.response_index = 2 and not exists (
        select 1
        from public.pet_answer_history existing
        where existing.answered_on = new.answered_on
          and existing.question_index = new.question_index
          and existing.response_index = 1
    ) then
        raise exception 'La primera respuesta de esta pregunta debe guardarse antes de la segunda.'
            using errcode = '23514';
    end if;

    new.responder_name := left(btrim(new.responder_name), 40);
    return new;
end;
$$;

revoke execute on function public.validate_pet_answer_history_slot() from public, anon, authenticated;

drop trigger if exists pet_answer_history_validate_slot on public.pet_answer_history;
create trigger pet_answer_history_validate_slot
    before insert on public.pet_answer_history
    for each row
    execute function public.validate_pet_answer_history_slot();

create or replace function public.sync_pet_answer_history_to_shared_pet()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    update public.shared_pet
    set food_count = coalesce(food_count, 0) + case when new.response_index = 2 then 1 else 0 end,
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
