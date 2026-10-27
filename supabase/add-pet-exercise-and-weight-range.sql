begin;

alter table public.shared_pet
    add column if not exists last_exercised_on date;

alter table public.shared_pet
    alter column weight_kg type numeric using weight_kg::numeric;

alter table public.shared_pet
    drop constraint if exists shared_pet_weight_check;

commit;
