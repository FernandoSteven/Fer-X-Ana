-- Configuración inicial para los recuerdos públicos de Anita y Fernando.
-- Ejecuta este archivo en Supabase > SQL Editor > New query.

create table if not exists public.memories (
    id uuid primary key default gen_random_uuid(),
    kind text not null,
    title text not null default '',
    content text not null,
    song_url text,
    image_path text,
    created_at timestamptz not null default now(),
    constraint memories_content_length_check check (
        char_length(btrim(content)) > 0 and char_length(content) <= 3000
    ),
    constraint memories_song_url_check check (
        song_url is null or (
            char_length(song_url) <= 2048 and song_url ~* '^https?://'
        )
    ),
    constraint memories_title_length_check check (char_length(title) <= 100)
);

-- Actualiza las validaciones si la tabla ya existía con diario y música solamente.
alter table public.memories drop constraint if exists memories_kind_check;
alter table public.memories drop constraint if exists memories_image_path_check;
alter table public.memories drop constraint if exists memories_kind_fields_check;
alter table public.memories drop constraint if exists memories_title_length_check;

alter table public.memories
    add constraint memories_kind_check check (kind in ('diary', 'music', 'dedication')),
    add constraint memories_image_path_check check (
        image_path is null or image_path ~ '^(songs|dedications)/[0-9a-f-]{36}\.jpg$'
    ),
    add constraint memories_kind_fields_check check (
        (kind = 'diary' and song_url is null and image_path is null)
        or
        (kind = 'music'
            and char_length(content) <= 2000
            and image_path is not null
            and image_path ~ '^songs/[0-9a-f-]{36}\.jpg$')
        or
        (kind = 'dedication'
            and song_url is null
            and (image_path is null or image_path ~ '^dedications/[0-9a-f-]{36}\.jpg$'))
    ),
    add constraint memories_title_length_check check (
        char_length(title) <= 100
        and (kind <> 'dedication' or char_length(btrim(title)) > 0)
    );

alter table public.memories enable row level security;

grant usage on schema public to anon, authenticated;
revoke all on table public.memories from public, anon, authenticated;
grant select, delete on table public.memories to anon, authenticated;
grant insert (kind, title, content, song_url, image_path)
    on table public.memories to anon, authenticated;
grant update (title, content, song_url, image_path)
    on table public.memories to anon, authenticated;

drop policy if exists "Anyone can read shared memories" on public.memories;
create policy "Anyone can read shared memories"
    on public.memories for select
    to anon, authenticated
    using (true);

drop policy if exists "Anyone can add valid shared memories" on public.memories;
create policy "Anyone can add valid shared memories"
    on public.memories for insert
    to anon, authenticated
    with check (true);

drop policy if exists "Anyone can edit shared memories" on public.memories;
create policy "Anyone can edit shared memories"
    on public.memories for update
    to anon, authenticated
    using (true)
    with check (true);

drop policy if exists "Anyone can delete shared memories" on public.memories;
create policy "Anyone can delete shared memories"
    on public.memories for delete
    to anon, authenticated
    using (true);

-- El bucket público acepta fotos JPEG de hasta 1 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shared-memories', 'shared-memories', true, 1048576, array['image/jpeg'])
on conflict (id) do update set
    public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view shared memory photos" on storage.objects;
create policy "Anyone can view shared memory photos"
    on storage.objects for select
    to anon, authenticated
    using (bucket_id = 'shared-memories');

drop policy if exists "Anyone can add shared memory photos" on storage.objects;
create policy "Anyone can add shared memory photos"
    on storage.objects for insert
    to anon, authenticated
    with check (
        bucket_id = 'shared-memories'
        and name ~ '^(songs|dedications)/[0-9a-f-]{36}\.jpg$'
    );

drop policy if exists "Anyone can delete shared memory photos" on storage.objects;
create policy "Anyone can delete shared memory photos"
    on storage.objects for delete
    to anon, authenticated
    using (
        bucket_id = 'shared-memories'
        and name ~ '^(songs|dedications)/[0-9a-f-]{36}\.jpg$'
    );
