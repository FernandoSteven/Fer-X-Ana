begin;

alter table public.shared_pet
    drop constraint if exists shared_pet_outfit_check;

alter table public.shared_pet
    add constraint shared_pet_outfit_check
        check (outfit in ('none', 'collar', 'sweater', 'bow', 'pajamas', 'bee', 'raincoat', 'crown', 'six-seven', 'scholar'));

commit;