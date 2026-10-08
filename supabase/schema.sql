-- ============================================================
-- DersTakip v3 — Supabase şema + güvenlik (RLS)
-- İDEMPOTENTTİR: birden fazla kez çalıştırmak güvenlidir.
-- Supabase → SQL Editor'de TÜMÜNÜ çalıştırın.
--
-- NOT (v3.0.1): "relation parent_users does not exist" hatası,
-- students politikasının parent_users tablosundan ÖNCE
-- oluşturulmasından kaynaklanıyordu → sıralama düzeltildi.
--
-- Model:
--   students      : her öğrenci tek JSON belgesi (data), sahibi öğretmen
--   parent_users  : veli hesaplarının öğrenciyle bağlantısı
-- Veli erişimi: yalnızca bağlantı kurduğu (erişim koduyla doğrulanmış)
-- öğrenciyi OKUYABİLİR; yazma yetkisi yoktur.
-- ============================================================

-- ------------------------------------------------------------
-- 1) ÖĞRENCİ TABLOSU
-- ------------------------------------------------------------
create table if not exists public.students (
  id          uuid primary key,
  -- Satırı ekleyen (giriş yapmış) öğretmen otomatik sahip olur.
  owner_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  parent_code text unique,
  data        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists students_owner_idx on public.students (owner_id);

-- Eski sürüm şemasıyla oluşturulmuş tablolar için yama (idempotent):
alter table public.students alter column owner_id set default auth.uid();

alter table public.students enable row level security;

-- Öğretmen (satır sahibi) tüm işlemleri yapabilir.
drop policy if exists "ogrenciler_sahibi_yonetir" on public.students;
create policy "ogrenciler_sahibi_yonetir"
  on public.students
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- updated_at otomatik güncellensin
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists students_touch_updated_at on public.students;
create trigger students_touch_updated_at
  before update on public.students
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------------------
-- 2) VELİ HESAP BAĞLANTILARI (students politikasından ÖNCE olmalı!)
-- ------------------------------------------------------------
create table if not exists public.parent_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  student_id uuid not null references public.students (id) on delete cascade,
  full_name  text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists parent_users_student_idx on public.parent_users (student_id);

alter table public.parent_users enable row level security;

drop policy if exists "veli_kendi_baglantisi" on public.parent_users;
create policy "veli_kendi_baglantisi"
  on public.parent_users
  for select
  using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3) VELİ OKUMA POLİTİKASI (artık parent_users mevcut — güvenli)
-- ------------------------------------------------------------
drop policy if exists "veli_bagli_ogrenci_gorur" on public.students;
create policy "veli_bagli_ogrenci_gorur"
  on public.students
  for select
  using (
    exists (
      select 1 from public.parent_users pu
      where pu.user_id = auth.uid() and pu.student_id = students.id
    )
  );

-- ------------------------------------------------------------
-- 4) RPC FONKSİYONLARI
-- ------------------------------------------------------------

-- (a) Kod ile hızlı giriş (hesapsız, salt-okunur, tek öğrenci)
create or replace function public.parent_get_student(p_code text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select s.data
  from public.students s
  where s.parent_code = nullif(btrim(p_code), '')
  limit 1;
$$;

-- (b) Kayıtlı veli: erişim kodunu hesabına bağlar
create or replace function public.parent_link(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student public.students;
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Oturum bulunamadı — önce giriş yapın';
  end if;

  select * into v_student
  from public.students
  where parent_code = nullif(btrim(p_code), '');

  if v_student.id is null then
    raise exception 'Erişim kodu geçersiz';
  end if;

  insert into public.parent_users (user_id, student_id, full_name)
  values (v_uid, v_student.id, coalesce((select raw_user_meta_data->>'full_name' from auth.users where id = v_uid), ''))
  on conflict (user_id) do update
    set student_id = excluded.student_id;

  return v_student.data;
end $$;

-- (c) Kayıtlı veli: bağlı öğrenciyi getir (bağlantı yoksa null)
create or replace function public.parent_get_me()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select s.data
  from public.students s
  join public.parent_users pu on pu.student_id = s.id
  where pu.user_id = auth.uid()
  limit 1;
$$;

-- (d) Kayıtlı veli: bağlantıyı kes
create or replace function public.parent_unlink()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.parent_users where user_id = auth.uid();
$$;

-- (e) Öğretmen: bir öğrenciye bağlı veli hesaplarını listele
create or replace function public.student_parents(p_student uuid)
returns table (user_id uuid, full_name text, email text, linked_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select pu.user_id, pu.full_name, coalesce(u.email, ''), pu.created_at
  from public.parent_users pu
  join public.students s on s.id = pu.student_id
  join auth.users u on u.id = pu.user_id
  where s.id = p_student
    and s.owner_id = auth.uid();
$$;

-- Yetkiler: yalnızca gerekli roller çalıştırabilsin
revoke all on function public.parent_get_student(text) from public;
revoke all on function public.parent_link(text) from public;
revoke all on function public.parent_get_me() from public;
revoke all on function public.parent_unlink() from public;
revoke all on function public.student_parents(uuid) from public;

grant execute on function public.parent_get_student(text) to anon, authenticated;
grant execute on function public.parent_link(text)      to authenticated;
grant execute on function public.parent_get_me()        to authenticated;
grant execute on function public.parent_unlink()        to authenticated;
grant execute on function public.student_parents(uuid)  to authenticated;

-- ------------------------------------------------------------
-- 5) ÖĞRETMEN HESABI KURULUMU
--   Authentication → Users → Add user (e-posta + şifre)
--   "Allow new users to sign up" AÇIK kalmalı (veliler kayıt olacak).
-- ------------------------------------------------------------
