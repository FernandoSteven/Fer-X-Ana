-- Configuración inicial para los recuerdos públicos de Anita y Fernando.
-- Ejecuta este archivo una vez en Supabase > SQL Editor > New query.

create table if not exists public.memories (
    id uuid primary key default gen_random_uuid(),
    kind text not null check (kind in ('diary', 'music')),
    title text not null default '' check (char_length(title) <= 100),
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
    constraint memories_image_path_check check (
        image_path is null or image_path ~ '^songs/[0-9a-f-]{36}\.jpg$'
    ),
    constraint memories_kind_fields_check check (
        (kind = 'diary' and song_url is null and image_path is null)
        or
        (kind = 'music' and char_length(content) <= 2000 and image_path is not null)
    )
);

alter table public.memories enable row level security;

grant usage on schema public to anon, authenticated;
revoke all on table public.memories from public, anon, authenticated;
grant select on table public.memories to anon, authenticated;
grant insert (kind, title, content, song_url, image_path)
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
    with check (
        char_length(title) <= 100
        and char_length(btrim(content)) > 0
        and char_length(content) <= 3000
        and (
            (kind = 'diary' and song_url is null and image_path is null)
            or
            (kind = 'music'
                and char_length(content) <= 2000
                and image_path ~ '^songs/[0-9a-f-]{36}\.jpg$'
                and (song_url is null or (char_length(song_url) <= 2048 and song_url ~* '^https?://')))
        )
    );

-- La carpeta de canciones solo acepta imágenes JPEG de hasta 1 MB.
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
        and name ~ '^songs/[0-9a-f-]{36}\.jpg$'
    );

-- No se conceden permisos ni políticas públicas de modificación o eliminación.
