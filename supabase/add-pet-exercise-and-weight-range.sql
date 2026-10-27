begin;

alter table public.shared_pet
    add column if not exists last_exercised_on date;

alter table public.shared_pet
    add column if not exists weight_updated_on date;

update public.shared_pet
set weight_updated_on = coalesce(last_fed_on, current_date)
where weight_updated_on is null;

alter table public.shared_pet
    alter column weight_updated_on set default current_date,
    alter column weight_updated_on set not null;

alter table public.shared_pet
    alter column weight_kg type numeric using weight_kg::numeric;

alter table public.shared_pet
    drop constraint if exists shared_pet_weight_check;

commit;
