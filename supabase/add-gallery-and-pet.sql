-- Añade la galería pública de fotos y videos y el cachorro compartido.
-- Ejecuta este archivo completo en Supabase > SQL Editor > New query.

create table if not exists public.gallery_items (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    content text not null default '',
    media_path text not null,
    media_type text not null,
    created_at timestamptz not null default now(),
    constraint gallery_title_length_check check (
        char_length(btrim(title)) > 0 and char_length(title) <= 100
    ),
    constraint gallery_content_length_check check (char_length(content) <= 1500),
    constraint gallery_media_type_check check (media_type in ('image', 'video')),
    constraint gallery_media_path_check check (
        media_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|mp4|webm|mov)$'
    )
);

alter table public.gallery_items enable row level security;
grant usage on schema public to anon, authenticated;
revoke all on table public.gallery_items from public, anon, authenticated;
grant select, insert, update, delete on table public.gallery_items to anon, authenticated;

drop policy if exists "Anyone can read shared gallery" on public.gallery_items;
create policy "Anyone can read shared gallery"
    on public.gallery_items for select to anon, authenticated using (true);

drop policy if exists "Anyone can add shared gallery items" on public.gallery_items;
create policy "Anyone can add shared gallery items"
    on public.gallery_items for insert to anon, authenticated with check (true);

drop policy if exists "Anyone can edit shared gallery items" on public.gallery_items;
create policy "Anyone can edit shared gallery items"
    on public.gallery_items for update to anon, authenticated using (true) with check (true);

drop policy if exists "Anyone can delete shared gallery items" on public.gallery_items;
create policy "Anyone can delete shared gallery items"
    on public.gallery_items for delete to anon, authenticated using (true);

create table if not exists public.shared_pet (
    id smallint primary key default 1 check (id = 1),
    name text not null default 'Nube',
    weight_kg numeric not null default 4.00,
    food_count integer not null default 0,
    last_fed_on date,
    last_exercised_on date,
    last_answered_on date,
    last_answer text not null default '',
    outfit text not null default 'none',
    created_at timestamptz not null default now(),
    constraint shared_pet_name_check check (
        char_length(btrim(name)) between 1 and 24
    ),
    constraint shared_pet_food_check check (food_count >= 0),
    constraint shared_pet_answer_check check (char_length(last_answer) <= 500),
    constraint shared_pet_outfit_check check (outfit in ('none', 'collar', 'sweater', 'bow', 'pajamas', 'bee', 'raincoat', 'crown', 'six-seven', 'scholar'))
);

insert into public.shared_pet (id) values (1)
on conflict (id) do nothing;

alter table public.shared_pet enable row level security;
revoke all on table public.shared_pet from public, anon, authenticated;
grant select, update on table public.shared_pet to anon, authenticated;

drop policy if exists "Anyone can read shared pet" on public.shared_pet;
create policy "Anyone can read shared pet"
    on public.shared_pet for select to anon, authenticated using (true);

drop policy if exists "Anyone can care for shared pet" on public.shared_pet;
create policy "Anyone can care for shared pet"
    on public.shared_pet for update to anon, authenticated using (true) with check (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'shared-gallery',
    'shared-gallery',
    true,
    52428800,
    array['image/jpeg', 'video/mp4', 'video/webm', 'video/quicktime']
)
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view shared gallery media" on storage.objects;
create policy "Anyone can view shared gallery media"
    on storage.objects for select to anon, authenticated
    using (bucket_id = 'shared-gallery');

drop policy if exists "Anyone can add shared gallery media" on storage.objects;
create policy "Anyone can add shared gallery media"
    on storage.objects for insert to anon, authenticated
    with check (
        bucket_id = 'shared-gallery'
        and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|mp4|webm|mov)$'
    );

drop policy if exists "Anyone can delete shared gallery media" on storage.objects;
create policy "Anyone can delete shared gallery media"
    on storage.objects for delete to anon, authenticated
    using (
        bucket_id = 'shared-gallery'
        and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](jpg|mp4|webm|mov)$'
    );
