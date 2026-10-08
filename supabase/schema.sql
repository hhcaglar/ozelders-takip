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

-- ============================================================
-- 6) EK SÜRE — Microsoft Family Safety entegrasyonu (v3.3)
--
-- Akış:
--   1. Öğretmen bir ödevi "Teslim edildi" yapar → öğrenci Family Safety'ye
--      bağlıysa o ödev için BİR KEZ "ek süre hakkı" (varsayılan 60 dk) oluşur.
--      (Tetikleyici sunucu tarafında çalışır; tarayıcıya bağlı değildir.)
--   2. Çocuğun süresi bitince bilgisayarda "Daha fazla süre iste" der.
--   3. Vercel'deki /api/aile-senkron fonksiyonu (pg_cron ile dakikada bir
--      tetiklenir) bekleyen isteği görür; hak varsa ve günlük sınır
--      dolmadıysa isteği +60 dk ile onaylar, hakkı "kullanıldı" yapar.
--
-- Güvenlik:
--   • Microsoft yenileme belirteci (refresh token) fs_connections tablosunda
--     durur. Tarayıcı rolleri (anon / authenticated) bu tabloya ERİŞEMEZ;
--     yalnızca service_role (Vercel sunucu fonksiyonu) kullanır.
--   • Öğretmen arayüzü yalnızca aşağıdaki security definer RPC'leri kullanır.
--   • Microsoft'un Family Safety için resmî API'si yoktur; kullanılan uç
--     noktalar Family Safety Android uygulamasının kullandıklarıdır.
-- ============================================================

-- (a) Öğretmenin Microsoft (aile düzenleyicisi) bağlantısı
create table if not exists public.fs_connections (
  owner_id          uuid primary key references auth.users (id) on delete cascade,
  ms_user_id        text not null default '',
  refresh_token     text not null,
  access_token      text,
  access_expires_at timestamptz,
  status            text not null default 'ok',
  last_error        text,
  last_sync_at      timestamptz,
  sync_lock_until   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint fs_connections_status_chk check (status in ('ok', 'yeniden_giris'))
);

-- (b) DersTakip öğrencisi ↔ Family Safety çocuğu eşleşmesi + kurallar
create table if not exists public.fs_links (
  student_id         uuid primary key references public.students (id) on delete cascade,
  owner_id           uuid not null references auth.users (id) on delete cascade,
  ms_child_id        text not null,
  ms_child_name      text not null default '',
  enabled            boolean not null default true,
  minutes_per_credit integer not null default 60,
  daily_max          integer not null default 1,     -- günde en fazla kaç hak (0 = sınırsız)
  request_scope      text not null default 'hepsi',  -- hepsi | cihaz | uygulama
  app_filter         text not null default '',       -- örn. "minecraft" (boş = tüm uygulamalar)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint fs_links_minutes_chk check (minutes_per_credit between 5 and 600),
  constraint fs_links_daily_chk check (daily_max between 0 and 10),
  constraint fs_links_scope_chk check (request_scope in ('hepsi', 'cihaz', 'uygulama'))
);
create unique index if not exists fs_links_owner_child_uq on public.fs_links (owner_id, ms_child_id);

-- (c) Ek süre hakları — teslim edilen her ödev için en fazla bir tane
create table if not exists public.fs_credits (
  id           bigint generated always as identity primary key,
  student_id   uuid not null references public.students (id) on delete cascade,
  owner_id     uuid not null references auth.users (id) on delete cascade,
  homework_id  text,                    -- null = öğretmenin elle eklediği hak
  title        text not null default '',
  minutes      integer not null default 60,
  status       text not null default 'hazir',
  note         text,
  request_key  text,                    -- onaylanan Family Safety isteğinin kalıcı anahtarı
  request_type text,                    -- DeviceScreenTime | AppScreenTime
  app_name     text,
  created_at   timestamptz not null default now(),
  reserved_at  timestamptz,
  used_at      timestamptz,
  constraint fs_credits_status_chk check (status in ('hazir', 'ayrildi', 'kullanildi', 'iptal')),
  constraint fs_credits_minutes_chk check (minutes between 1 and 600)
);
create unique index if not exists fs_credits_homework_uq
  on public.fs_credits (student_id, homework_id) where homework_id is not null;
create index if not exists fs_credits_student_idx on public.fs_credits (student_id, status, created_at);
create index if not exists fs_credits_request_idx
  on public.fs_credits (owner_id, request_key) where request_key is not null;

-- (d) Olay günlüğü (onaylar, hak olmadığı için bekletilen istekler, hatalar)
create table if not exists public.fs_events (
  id          bigint generated always as identity primary key,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  student_id  uuid references public.students (id) on delete cascade,
  kind        text not null,
  message     text not null default '',
  request_key text,
  created_at  timestamptz not null default now()
);
create unique index if not exists fs_events_request_uq
  on public.fs_events (owner_id, kind, request_key) where request_key is not null;
create index if not exists fs_events_owner_idx on public.fs_events (owner_id, created_at desc);

-- RLS: tarayıcı rolleri belirteç tablosunu hiç göremez; diğerlerini yalnızca
-- sahibi okuyabilir. Tüm yazmalar aşağıdaki RPC'ler üzerinden yapılır.
alter table public.fs_connections enable row level security;
alter table public.fs_links       enable row level security;
alter table public.fs_credits     enable row level security;
alter table public.fs_events      enable row level security;

revoke all on public.fs_connections from anon, authenticated;
revoke all on public.fs_links, public.fs_credits, public.fs_events from anon;
revoke insert, update, delete, truncate on public.fs_links, public.fs_credits, public.fs_events from authenticated;
grant select on public.fs_links, public.fs_credits, public.fs_events to authenticated;

drop policy if exists "fs_links_sahibi_gorur" on public.fs_links;
create policy "fs_links_sahibi_gorur" on public.fs_links for select using (auth.uid() = owner_id);
drop policy if exists "fs_credits_sahibi_gorur" on public.fs_credits;
create policy "fs_credits_sahibi_gorur" on public.fs_credits for select using (auth.uid() = owner_id);
drop policy if exists "fs_events_sahibi_gorur" on public.fs_events;
create policy "fs_events_sahibi_gorur" on public.fs_events for select using (auth.uid() = owner_id);

-- Türkiye saatine göre "bugün" (günlük sınır bu güne göre sayılır)
create or replace function public.fs_today()
returns date
language sql
stable
set search_path = public
as $$
  select (now() at time zone 'Europe/Istanbul')::date
$$;

-- ------------------------------------------------------------
-- 6.1) TETİKLEYİCİ: ödev "teslim" olunca bir seferlik hak oluştur
-- ------------------------------------------------------------
create or replace function public.fs_on_homework_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link public.fs_links;
  v_old  jsonb := case when jsonb_typeof(old.data -> 'homeworks') = 'array'
                       then old.data -> 'homeworks' else '[]'::jsonb end;
  v_new  jsonb := case when jsonb_typeof(new.data -> 'homeworks') = 'array'
                       then new.data -> 'homeworks' else '[]'::jsonb end;
begin
  select * into v_link from public.fs_links where student_id = new.id;
  if not found or not v_link.enabled then
    return null;
  end if;

  -- Teslimden geri alınan ödevlerin KULLANILMAMIŞ hakkı iptal edilir.
  -- (Silinen ödevlere dokunulmaz: ödev yapılmıştı, hak durur.)
  update public.fs_credits c
     set status = 'iptal', note = 'Ödev teslimden geri alındı'
   where c.student_id = new.id
     and c.status = 'hazir'
     and c.homework_id in (
       select h ->> 'id'
       from jsonb_array_elements(v_new) h
       where coalesce(h ->> 'status', '') <> 'teslim'
         and exists (select 1 from jsonb_array_elements(v_old) o
                     where o ->> 'id' = h ->> 'id' and o ->> 'status' = 'teslim')
     );

  -- Yeni teslim edilen her ödev için tek hak. Aynı ödev yeniden "teslim"
  -- yapılırsa yeni hak açılmaz; yalnızca iptal edilmiş hak geri gelir.
  insert into public.fs_credits (student_id, owner_id, homework_id, title, minutes)
  select new.id, new.owner_id, h ->> 'id', left(coalesce(h ->> 'title', ''), 200), v_link.minutes_per_credit
  from jsonb_array_elements(v_new) h
  where h ->> 'status' = 'teslim'
    and coalesce(h ->> 'id', '') <> ''
    and not exists (select 1 from jsonb_array_elements(v_old) o
                    where o ->> 'id' = h ->> 'id' and o ->> 'status' = 'teslim')
  on conflict (student_id, homework_id) where homework_id is not null
  do update set status = 'hazir', note = null, minutes = excluded.minutes, created_at = now()
     where fs_credits.status = 'iptal';

  return null;
end $$;

drop trigger if exists students_fs_credits on public.students;
create trigger students_fs_credits
  after update on public.students
  for each row
  when (old.data -> 'homeworks' is distinct from new.data -> 'homeworks')
  execute function public.fs_on_homework_change();

-- ------------------------------------------------------------
-- 6.2) ÖĞRETMEN RPC'LERİ (authenticated)
-- ------------------------------------------------------------
create or replace function public.fs_assert_owner(p_student uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (
    select 1 from public.students s where s.id = p_student and s.owner_id = auth.uid()
  ) then
    raise exception 'Bu öğrenci için yetkiniz yok' using errcode = '42501';
  end if;
end $$;

-- Sekmenin ihtiyaç duyduğu her şey tek çağrıda (belirteçler ASLA dönmez)
create or replace function public.fs_overview(p_student uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_conn public.fs_connections;
  v_link public.fs_links;
begin
  perform public.fs_assert_owner(p_student);
  select * into v_conn from public.fs_connections where owner_id = v_uid;
  select * into v_link from public.fs_links where student_id = p_student;

  return jsonb_build_object(
    'connection', case when v_conn.owner_id is null then null else jsonb_build_object(
      'ms_user_id',   v_conn.ms_user_id,
      'status',       v_conn.status,
      'last_error',   v_conn.last_error,
      'last_sync_at', v_conn.last_sync_at,
      'created_at',   v_conn.created_at) end,
    'link', case when v_link.student_id is null then null else jsonb_build_object(
      'ms_child_id',        v_link.ms_child_id,
      'ms_child_name',      v_link.ms_child_name,
      'enabled',            v_link.enabled,
      'minutes_per_credit', v_link.minutes_per_credit,
      'daily_max',          v_link.daily_max,
      'request_scope',      v_link.request_scope,
      'app_filter',         v_link.app_filter) end,
    'credits', coalesce((
      select jsonb_agg(to_jsonb(c) - 'owner_id' - 'student_id' - 'request_key' order by c.created_at desc, c.id desc)
      from (select * from public.fs_credits where student_id = p_student
            order by created_at desc, id desc limit 50) c), '[]'::jsonb),
    'by_homework', coalesce((
      select jsonb_object_agg(c.homework_id, jsonb_build_object('status', c.status, 'minutes', c.minutes))
      from public.fs_credits c where c.student_id = p_student and c.homework_id is not null), '{}'::jsonb),
    'available', (select count(*) from public.fs_credits where student_id = p_student and status = 'hazir'),
    'used_today', (select count(*) from public.fs_credits
                   where student_id = p_student and status in ('ayrildi', 'kullanildi')
                     and (coalesce(used_at, reserved_at) at time zone 'Europe/Istanbul')::date = public.fs_today()),
    'used_total', (select count(*) from public.fs_credits where student_id = p_student and status = 'kullanildi'),
    'events', coalesce((
      select jsonb_agg(to_jsonb(e) - 'owner_id' - 'request_key' order by e.created_at desc, e.id desc)
      from (select * from public.fs_events
            where owner_id = v_uid and (student_id = p_student or student_id is null)
            order by created_at desc, id desc limit 25) e), '[]'::jsonb),
    'waiting_total', (select count(*) from public.fs_credits c
                      join public.fs_links l on l.student_id = c.student_id
                      where c.owner_id = v_uid and l.enabled and c.status in ('hazir', 'ayrildi')),
    'server_time', now()
  );
end $$;

create or replace function public.fs_link_student(p_student uuid, p_child_id text, p_child_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fs_assert_owner(p_student);
  if nullif(btrim(coalesce(p_child_id, '')), '') is null then
    raise exception 'Family Safety çocuğu seçilmedi';
  end if;
  begin
    insert into public.fs_links (student_id, owner_id, ms_child_id, ms_child_name)
    values (p_student, auth.uid(), btrim(p_child_id), left(coalesce(p_child_name, ''), 120))
    on conflict (student_id) do update
      set ms_child_id = excluded.ms_child_id,
          ms_child_name = excluded.ms_child_name,
          updated_at = now();
  exception when unique_violation then
    raise exception 'Bu Family Safety hesabı zaten başka bir öğrenciye bağlı';
  end;
  return public.fs_overview(p_student);
end $$;

create or replace function public.fs_unlink_student(p_student uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.fs_assert_owner(p_student);
  delete from public.fs_links where student_id = p_student;
  return public.fs_overview(p_student);
end $$;

create or replace function public.fs_update_settings(
  p_student    uuid,
  p_enabled    boolean default null,
  p_minutes    integer default null,
  p_daily_max  integer default null,
  p_scope      text    default null,
  p_app_filter text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minutes integer := case when p_minutes is null then null else least(greatest(p_minutes, 5), 600) end;
begin
  perform public.fs_assert_owner(p_student);
  if p_scope is not null and p_scope not in ('hepsi', 'cihaz', 'uygulama') then
    raise exception 'Geçersiz istek türü: %', p_scope;
  end if;
  update public.fs_links
     set enabled            = coalesce(p_enabled, enabled),
         minutes_per_credit = coalesce(v_minutes, minutes_per_credit),
         daily_max          = coalesce(least(greatest(p_daily_max, 0), 10), daily_max),
         request_scope      = coalesce(p_scope, request_scope),
         app_filter         = coalesce(left(btrim(p_app_filter), 60), app_filter),
         updated_at         = now()
   where student_id = p_student;
  if not found then
    raise exception 'Önce öğrenciyi bir Family Safety çocuğuyla eşleştirin';
  end if;
  -- Süre değiştiyse henüz kullanılmamış haklar da yeni süreyi alır
  if v_minutes is not null then
    update public.fs_credits set minutes = v_minutes
     where student_id = p_student and status = 'hazir';
  end if;
  return public.fs_overview(p_student);
end $$;

create or replace function public.fs_add_credit(p_student uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minutes integer;
begin
  perform public.fs_assert_owner(p_student);
  select minutes_per_credit into v_minutes from public.fs_links where student_id = p_student;
  insert into public.fs_credits (student_id, owner_id, homework_id, title, minutes)
  values (p_student, auth.uid(), null,
          coalesce(nullif(left(btrim(coalesce(p_note, '')), 200), ''), 'Elle eklenen hak'),
          coalesce(v_minutes, 60));
  return public.fs_overview(p_student);
end $$;

create or replace function public.fs_cancel_credit(p_credit bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student uuid;
begin
  select student_id into v_student from public.fs_credits where id = p_credit;
  if v_student is null then
    raise exception 'Hak bulunamadı';
  end if;
  perform public.fs_assert_owner(v_student);
  update public.fs_credits
     set status = 'iptal', note = 'Öğretmen iptal etti'
   where id = p_credit and status = 'hazir';
  return public.fs_overview(v_student);
end $$;

-- Microsoft bağlantısını kaldırır (belirteç silinir). Eşleşmeler ve haklar kalır.
create or replace function public.fs_disconnect()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Oturum bulunamadı' using errcode = '42501';
  end if;
  delete from public.fs_connections where owner_id = auth.uid();
  insert into public.fs_events (owner_id, kind, message)
  values (auth.uid(), 'baglanti', 'Microsoft bağlantısı kaldırıldı');
end $$;

-- ------------------------------------------------------------
-- 6.3) SUNUCU RPC'LERİ (yalnızca service_role — Vercel fonksiyonu)
-- ------------------------------------------------------------
create or replace function public.fs_log(
  p_owner       uuid,
  p_student     uuid,
  p_kind        text,
  p_message     text,
  p_request_key text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_request_key is not null then
    -- Aynı istek için aynı türde olay bir kez yazılır
    insert into public.fs_events (owner_id, student_id, kind, message, request_key)
    values (p_owner, p_student, p_kind, left(coalesce(p_message, ''), 500), p_request_key)
    on conflict (owner_id, kind, request_key) where request_key is not null do nothing;
  elsif not exists (
    select 1 from public.fs_events
    where owner_id = p_owner and kind = p_kind and message = left(coalesce(p_message, ''), 500)
      and created_at > now() - interval '1 hour'
  ) then
    -- Tekrarlayan hata mesajları saatte bir kez yazılır
    insert into public.fs_events (owner_id, student_id, kind, message)
    values (p_owner, p_student, p_kind, left(coalesce(p_message, ''), 500));
  end if;

  -- Öğretmen başına son 500 olay tutulur
  delete from public.fs_events
   where owner_id = p_owner
     and id < (select id from public.fs_events where owner_id = p_owner
               order by id desc offset 499 limit 1);
end $$;

create or replace function public.fs_save_connection(
  p_owner         uuid,
  p_ms_user_id    text,
  p_refresh_token text,
  p_access_token  text,
  p_expires_at    timestamptz
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if nullif(p_refresh_token, '') is null then
    raise exception 'Yenileme belirteci boş olamaz';
  end if;
  insert into public.fs_connections (owner_id, ms_user_id, refresh_token, access_token, access_expires_at, status, last_error)
  values (p_owner, coalesce(p_ms_user_id, ''), p_refresh_token, p_access_token, p_expires_at, 'ok', null)
  on conflict (owner_id) do update
    set ms_user_id = excluded.ms_user_id,
        refresh_token = excluded.refresh_token,
        access_token = excluded.access_token,
        access_expires_at = excluded.access_expires_at,
        status = 'ok',
        last_error = null,
        sync_lock_until = null,
        updated_at = now();
  perform public.fs_log(p_owner, null, 'baglanti', 'Microsoft hesabı bağlandı', null);
end $$;

-- Çocuk listesini çekmek için bağlantı belirteçlerini döner (kilitlemez)
create or replace function public.fs_get_connection(p_owner uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'owner_id', c.owner_id, 'ms_user_id', c.ms_user_id, 'status', c.status,
    'refresh_token', c.refresh_token, 'access_token', c.access_token,
    'access_expires_at', c.access_expires_at)
  from public.fs_connections c
  where c.owner_id = p_owner;
$$;

-- Yalnızca token alanlarını günceller (her yenilemede Microsoft yeni belirteç verir)
create or replace function public.fs_save_tokens(
  p_owner         uuid,
  p_refresh_token text,
  p_access_token  text,
  p_expires_at    timestamptz
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.fs_connections
     set refresh_token = coalesce(nullif(p_refresh_token, ''), refresh_token),
         access_token = p_access_token,
         access_expires_at = p_expires_at,
         updated_at = now()
   where owner_id = p_owner;
$$;

-- Senkron için işi olan bağlantıları seçer ve 2 dakikalığına kilitler
-- (aynı anda iki çağrı aynı isteği iki kez onaylayamasın diye).
create or replace function public.fs_claim_sync(p_owner uuid default null, p_force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows jsonb;
begin
  with candidates as (
    select c.owner_id,
           exists (select 1 from public.fs_credits cr
                   join public.fs_links l on l.student_id = cr.student_id
                   where cr.owner_id = c.owner_id and l.enabled
                     and cr.status in ('hazir', 'ayrildi')) as needs_work
    from public.fs_connections c
    where (p_owner is null or c.owner_id = p_owner)
      and c.status = 'ok'
      and (c.sync_lock_until is null or c.sync_lock_until < now())
    for update of c skip locked
  ),
  claimed as (
    update public.fs_connections c
       set sync_lock_until = now() + interval '2 minutes'
      from candidates k
     where c.owner_id = k.owner_id
       and (p_force or k.needs_work or c.last_sync_at is null
            or c.last_sync_at < now() - interval '20 hours')
    returning c.owner_id, c.ms_user_id, c.refresh_token, c.access_token, c.access_expires_at, k.needs_work
  )
  select coalesce(jsonb_agg(to_jsonb(claimed)), '[]'::jsonb) into v_rows from claimed;
  return v_rows;
end $$;

create or replace function public.fs_finish_sync(
  p_owner  uuid,
  p_error  text    default null,
  p_reauth boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.fs_connections
     set last_sync_at = now(),
         sync_lock_until = null,
         last_error = left(p_error, 500),
         status = case when p_reauth then 'yeniden_giris' else status end,
         updated_at = now()
   where owner_id = p_owner;
  if p_reauth then
    perform public.fs_log(p_owner, null, 'yeniden_giris',
      'Microsoft oturumu sona erdi — Ek Süre sekmesinden yeniden giriş yapın', null);
  elsif p_error is not null then
    perform public.fs_log(p_owner, null, 'hata', p_error, null);
  end if;
end $$;

-- Senkronun ihtiyaç duyduğu, etkin eşleşmeler (çocuk kimliği → öğrenci)
create or replace function public.fs_links_for_sync(p_owner uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'student_id',    l.student_id,
           'student_name',  coalesce(s.data ->> 'name', ''),
           'ms_child_id',   l.ms_child_id,
           'ms_child_name', l.ms_child_name,
           'request_scope', l.request_scope,
           'app_filter',    l.app_filter,
           'daily_max',     l.daily_max,
           'available',     (select count(*) from public.fs_credits c
                             where c.student_id = l.student_id and c.status in ('hazir', 'ayrildi'))
         )), '[]'::jsonb)
  from public.fs_links l
  join public.students s on s.id = l.student_id
  where l.owner_id = p_owner and l.enabled;
$$;

-- Bir Family Safety isteği için hak ayırır. Sonuç:
--   ok | already_used | no_credit | daily_limit | not_linked | disabled
create or replace function public.fs_reserve_credit(
  p_owner        uuid,
  p_child_id     text,
  p_request_key  text,
  p_request_type text default null,
  p_app_name     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_link       public.fs_links;
  v_credit     public.fs_credits;
  v_used_today integer;
begin
  select * into v_link from public.fs_links where owner_id = p_owner and ms_child_id = p_child_id;
  if not found then
    return jsonb_build_object('result', 'not_linked');
  end if;
  if not v_link.enabled then
    return jsonb_build_object('result', 'disabled', 'student_id', v_link.student_id);
  end if;

  -- Bu istek daha önce işlendi mi? (istek kimliği her sorguda değiştiği için
  -- Microsoft'un id'si değil, kalıcı alanlardan üretilen anahtar kullanılır)
  select * into v_credit from public.fs_credits
   where owner_id = p_owner and request_key = p_request_key and status in ('ayrildi', 'kullanildi')
   order by id desc limit 1
   for update;
  if found then
    if v_credit.status = 'kullanildi' then
      return jsonb_build_object('result', 'already_used', 'credit_id', v_credit.id, 'student_id', v_credit.student_id);
    end if;
    -- Önceki deneme yarıda kalmış → aynı hakla yeniden denenir
    return jsonb_build_object('result', 'ok', 'retry', true, 'credit_id', v_credit.id,
                              'minutes', v_credit.minutes, 'title', v_credit.title,
                              'student_id', v_credit.student_id);
  end if;

  select count(*) into v_used_today from public.fs_credits
   where student_id = v_link.student_id and status in ('ayrildi', 'kullanildi')
     and (coalesce(used_at, reserved_at) at time zone 'Europe/Istanbul')::date = public.fs_today();
  if v_link.daily_max > 0 and v_used_today >= v_link.daily_max then
    return jsonb_build_object('result', 'daily_limit', 'student_id', v_link.student_id,
                              'used_today', v_used_today, 'daily_max', v_link.daily_max);
  end if;

  select * into v_credit from public.fs_credits
   where student_id = v_link.student_id and status = 'hazir'
   order by created_at, id
   limit 1
   for update skip locked;
  if not found then
    return jsonb_build_object('result', 'no_credit', 'student_id', v_link.student_id);
  end if;

  update public.fs_credits
     set status = 'ayrildi', reserved_at = now(), request_key = p_request_key,
         request_type = p_request_type, app_name = left(p_app_name, 120), note = null
   where id = v_credit.id;

  return jsonb_build_object('result', 'ok', 'credit_id', v_credit.id, 'minutes', v_credit.minutes,
                            'title', v_credit.title, 'student_id', v_link.student_id);
end $$;

create or replace function public.fs_finish_credit(p_credit bigint, p_success boolean, p_error text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_success then
    update public.fs_credits
       set status = 'kullanildi', used_at = now(), note = null
     where id = p_credit and status = 'ayrildi';
  else
    -- Onay başarısız → hak geri verilir
    update public.fs_credits
       set status = 'hazir', reserved_at = null, request_key = null, request_type = null,
           app_name = null, note = left(p_error, 300)
     where id = p_credit and status = 'ayrildi';
  end if;
end $$;

-- Ayrılmış ama sonucu kaydedilememiş haklar: istek artık beklemede değilse
-- (10 dk sonra) onaylanmış sayılır — ebeveyn lehine temkinli varsayım.
create or replace function public.fs_reconcile(p_owner uuid, p_pending_keys text[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.fs_credits
     set status = 'kullanildi', used_at = coalesce(used_at, reserved_at),
         note = 'Onay sonucu kaydedilemedi; istek artık beklemede olmadığı için kullanılmış sayıldı'
   where owner_id = p_owner
     and status = 'ayrildi'
     and reserved_at < now() - interval '10 minutes'
     and not (request_key = any (coalesce(p_pending_keys, '{}'::text[])));
  get diagnostics v_count = row_count;
  return v_count;
end $$;

-- Yetkiler ----------------------------------------------------
-- İç yardımcılar ve tetikleyici: istemciden çağrılamaz
revoke all on function public.fs_today() from public, anon, authenticated;
revoke all on function public.fs_on_homework_change() from public, anon, authenticated;
revoke all on function public.fs_assert_owner(uuid) from public, anon, authenticated;

-- Öğretmen arayüzü
revoke all on function public.fs_overview(uuid) from public, anon;
revoke all on function public.fs_link_student(uuid, text, text) from public, anon;
revoke all on function public.fs_unlink_student(uuid) from public, anon;
revoke all on function public.fs_update_settings(uuid, boolean, integer, integer, text, text) from public, anon;
revoke all on function public.fs_add_credit(uuid, text) from public, anon;
revoke all on function public.fs_cancel_credit(bigint) from public, anon;
revoke all on function public.fs_disconnect() from public, anon;
grant execute on function public.fs_overview(uuid) to authenticated;
grant execute on function public.fs_link_student(uuid, text, text) to authenticated;
grant execute on function public.fs_unlink_student(uuid) to authenticated;
grant execute on function public.fs_update_settings(uuid, boolean, integer, integer, text, text) to authenticated;
grant execute on function public.fs_add_credit(uuid, text) to authenticated;
grant execute on function public.fs_cancel_credit(bigint) to authenticated;
grant execute on function public.fs_disconnect() to authenticated;

-- Sunucu fonksiyonu (service_role)
revoke all on function public.fs_log(uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.fs_save_connection(uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.fs_save_tokens(uuid, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.fs_get_connection(uuid) from public, anon, authenticated;
revoke all on function public.fs_claim_sync(uuid, boolean) from public, anon, authenticated;
revoke all on function public.fs_finish_sync(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.fs_links_for_sync(uuid) from public, anon, authenticated;
revoke all on function public.fs_reserve_credit(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.fs_finish_credit(bigint, boolean, text) from public, anon, authenticated;
revoke all on function public.fs_reconcile(uuid, text[]) from public, anon, authenticated;
grant execute on function public.fs_log(uuid, uuid, text, text, text) to service_role;
grant execute on function public.fs_save_connection(uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.fs_save_tokens(uuid, text, text, timestamptz) to service_role;
grant execute on function public.fs_get_connection(uuid) to service_role;
grant execute on function public.fs_claim_sync(uuid, boolean) to service_role;
grant execute on function public.fs_finish_sync(uuid, text, boolean) to service_role;
grant execute on function public.fs_links_for_sync(uuid) to service_role;
grant execute on function public.fs_reserve_credit(uuid, text, text, text, text) to service_role;
grant execute on function public.fs_finish_credit(bigint, boolean, text) to service_role;
grant execute on function public.fs_reconcile(uuid, text[]) to service_role;

-- Zamanlayıcı (pg_cron) kurulumu ayrı dosyadadır: supabase/ek-sure-zamanlayici.sql
