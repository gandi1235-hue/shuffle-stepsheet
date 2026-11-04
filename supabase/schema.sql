-- 셔플 스텝지 앱 DB 스키마 (Supabase SQL Editor에 그대로 붙여넣어 실행)

create extension if not exists pgcrypto;

-- 사용자 프로필
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);

-- 폴더 (개인 / 공유)
create table if not exists folders (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('personal', 'shared')),
  owner_id uuid not null references profiles(id) on delete cascade,
  invite_code text unique default encode(gen_random_bytes(6), 'hex'),
  created_at timestamptz not null default now()
);

-- 폴더 멤버와 권한
create table if not exists folder_members (
  folder_id uuid not null references folders(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  primary key (folder_id, user_id)
);

-- 노래 (폴더 안에서 제목+가수로 하나)
create table if not exists songs (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references folders(id) on delete cascade,
  title text not null,
  artist text not null default '',
  created_at timestamptz not null default now(),
  unique (folder_id, title, artist)
);

-- 스텝지 (같은 노래에 창작자별로 여러 개)
create table if not exists stepsheets (
  id uuid primary key default gen_random_uuid(),
  song_id uuid not null references songs(id) on delete cascade,
  folder_id uuid not null references folders(id) on delete cascade,
  creator_name text not null,
  creator_info text not null default '',
  lines jsonb not null default '[]'::jsonb,
  memo text not null default '',
  audio_path text,
  audio_url text,
  photo_paths text[] not null default '{}',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (song_id, creator_name)
);

create index if not exists stepsheets_search_idx
  on stepsheets using gin (to_tsvector('simple', coalesce(creator_name,'') || ' ' || coalesce(memo,'') || ' ' || coalesce(lines::text,'')));
create index if not exists songs_title_idx on songs (lower(title));

-- 가입하면 프로필과 개인 폴더 자동 생성
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare f uuid;
begin
  insert into profiles (id, display_name)
    values (new.id, coalesce(nullif(new.raw_user_meta_data->>'name', ''), nullif(new.raw_user_meta_data->>'full_name', ''), nullif(new.raw_user_meta_data->>'preferred_username', ''), nullif(new.raw_user_meta_data->>'nickname', ''), nullif(new.raw_user_meta_data->>'user_name', ''), split_part(coalesce(new.email, '회원'), '@', 1)));
  insert into folders (name, kind, owner_id) values ('내 스텝지', 'personal', new.id) returning id into f;
  insert into folder_members (folder_id, user_id, role) values (f, new.id, 'owner');
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- 권한 확인 함수
create or replace function my_role(fid uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from folder_members where folder_id = fid and user_id = auth.uid()
$$;

create or replace function can_edit(fid uuid) returns boolean
language sql stable as $$ select my_role(fid) in ('owner', 'editor') $$;

-- 초대 코드로 폴더 참여 (보기 전용으로 들어옴)
create or replace function join_folder(code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare f uuid;
begin
  select id into f from folders where invite_code = code and kind = 'shared';
  if f is null then raise exception '초대 코드가 맞지 않습니다'; end if;
  insert into folder_members (folder_id, user_id, role) values (f, auth.uid(), 'viewer')
    on conflict do nothing;
  return f;
end $$;

-- 공유 폴더 만들기
create or replace function create_shared_folder(folder_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare f uuid;
begin
  insert into folders (name, kind, owner_id) values (folder_name, 'shared', auth.uid()) returning id into f;
  insert into folder_members (folder_id, user_id, role) values (f, auth.uid(), 'owner');
  return f;
end $$;

-- RLS
alter table profiles enable row level security;
alter table folders enable row level security;
alter table folder_members enable row level security;
alter table songs enable row level security;
alter table stepsheets enable row level security;

create policy "profiles: 모두 읽기" on profiles for select using (true);
create policy "profiles: 본인 수정" on profiles for update using (id = auth.uid());

create policy "folders: 멤버 읽기" on folders for select using (my_role(id) is not null);
create policy "folders: 주인 수정" on folders for update using (my_role(id) = 'owner');
create policy "folders: 주인 삭제" on folders for delete using (my_role(id) = 'owner' and kind = 'shared');

create policy "members: 멤버 읽기" on folder_members for select using (my_role(folder_id) is not null);
create policy "members: 주인 관리" on folder_members for all using (my_role(folder_id) = 'owner');
-- 주인이 아닌 멤버는 스스로 나갈 수 있음
create policy "members: 본인 나가기" on folder_members for delete using (user_id = auth.uid() and role <> 'owner');

create policy "songs: 멤버 읽기" on songs for select using (my_role(folder_id) is not null);
create policy "songs: 편집자 쓰기" on songs for insert with check (can_edit(folder_id));
create policy "songs: 편집자 수정" on songs for update using (can_edit(folder_id));
create policy "songs: 편집자 삭제" on songs for delete using (can_edit(folder_id));

create policy "sheets: 멤버 읽기" on stepsheets for select using (my_role(folder_id) is not null);
create policy "sheets: 편집자 쓰기" on stepsheets for insert with check (can_edit(folder_id));
create policy "sheets: 편집자 수정" on stepsheets for update using (can_edit(folder_id));
create policy "sheets: 편집자 삭제" on stepsheets for delete using (can_edit(folder_id));

-- 저장소 버킷 (음원, 사진). 경로 규칙: <folder_id>/<파일명>
insert into storage.buckets (id, name, public) values ('audio', 'audio', false) on conflict do nothing;
insert into storage.buckets (id, name, public) values ('photos', 'photos', false) on conflict do nothing;

create policy "storage: 멤버 읽기" on storage.objects for select
  using (bucket_id in ('audio', 'photos') and my_role((storage.foldername(name))[1]::uuid) is not null);
create policy "storage: 편집자 올리기" on storage.objects for insert
  with check (bucket_id in ('audio', 'photos') and can_edit((storage.foldername(name))[1]::uuid));
create policy "storage: 편집자 삭제" on storage.objects for delete
  using (bucket_id in ('audio', 'photos') and can_edit((storage.foldername(name))[1]::uuid));

-- 노래 동기화: 줄별 시작 시각(초) 배열 (앱에서 '동기화' 버튼으로 기록)
alter table stepsheets add column if not exists sync jsonb;

-- 폴더 주인 넘기기 (주인만 가능, 멤버에게만)
create or replace function transfer_folder_owner(fid uuid, new_owner uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if my_role(fid) is distinct from 'owner' then raise exception '폴더 주인만 넘길 수 있어요'; end if;
  if not exists (select 1 from folder_members where folder_id = fid and user_id = new_owner) then raise exception '폴더 멤버가 아니에요'; end if;
  if new_owner = auth.uid() then return; end if;
  update folder_members set role = 'editor' where folder_id = fid and user_id = auth.uid();
  update folder_members set role = 'owner' where folder_id = fid and user_id = new_owner;
  update folders set owner_id = new_owner where id = fid;
end $$;

-- ── 2026-11 추가: 닉네임·아바타·폴더 톡 ──
alter table profiles add column if not exists nickname text not null default '';
alter table profiles add column if not exists avatar_path text;

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references folders(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index if not exists messages_folder_idx on messages (folder_id, created_at desc);
alter table messages enable row level security;
drop policy if exists "messages: 멤버 읽기" on messages;
drop policy if exists "messages: 멤버 쓰기" on messages;
drop policy if exists "messages: 삭제" on messages;
create policy "messages: 멤버 읽기" on messages for select using (my_role(folder_id) is not null);
create policy "messages: 멤버 쓰기" on messages for insert with check (my_role(folder_id) is not null and user_id = auth.uid());
create policy "messages: 삭제" on messages for delete using (user_id = auth.uid() or my_role(folder_id) = 'owner');
do $$ begin
  alter publication supabase_realtime add table messages;
exception when duplicate_object then null; end $$;

-- 아바타: 누구나 볼 수 있는 공개 버킷, 올리기는 본인 폴더({uid}/...)만
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict do nothing;
drop policy if exists "avatars: 모두 읽기" on storage.objects;
drop policy if exists "avatars: 본인 올리기" on storage.objects;
drop policy if exists "avatars: 본인 수정" on storage.objects;
drop policy if exists "avatars: 본인 삭제" on storage.objects;
create policy "avatars: 모두 읽기" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars: 본인 올리기" on storage.objects for insert with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: 본인 수정" on storage.objects for update using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars: 본인 삭제" on storage.objects for delete using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- AI 긴 작업(영상 보고 맞추기 등): 함수가 서버에서 이어서 돌리고 결과를 여기 남김. 앱은 자기 작업만 읽음(쓰기는 함수의 서비스 키만)
create table if not exists ai_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  sheet_id uuid references stepsheets(id) on delete cascade,
  kind text not null,
  status text not null default 'running' check (status in ('running', 'done', 'failed')),
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists ai_jobs_owner_idx on ai_jobs (created_by, created_at desc);
alter table ai_jobs enable row level security;
drop policy if exists "ai_jobs: 본인 읽기" on ai_jobs;
create policy "ai_jobs: 본인 읽기" on ai_jobs for select using (created_by = auth.uid());
