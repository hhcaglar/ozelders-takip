-- ============================================================
-- DersTakip — Ek Süre zamanlayıcısı (Supabase → SQL Editor'de BİR KEZ çalıştırın)
--
-- Ne yapar?
--   Her dakika kontrol eder: kullanılmamış bir ek süre hakkı varsa sitenizdeki
--   /api/aile-senkron fonksiyonunu çağırır; fonksiyon da çocuğun bekleyen
--   "daha fazla süre" isteğini onaylar. Hak yoksa HİÇBİR ŞEY yapmaz
--   (yalnızca her gece 04:00'te Microsoft oturumunu taze tutmak için bir kez çağırır).
--
-- Kolay yol: DersTakip → öğrenci → "Ek Süre" sekmesi → "Sunucu kurulumu"
-- bölümü bu dosyayı sizin değerlerinizle DOLDURULMUŞ olarak verir.
--
-- Elle kullanacaksanız aşağıdaki iki değeri değiştirin:
--   __SITE_ADRESI__    → sitenizin adresi, ör. https://veli.corluders.com
--   __GIZLI_ANAHTAR__  → Vercel'deki AILE_SENKRON_ANAHTARI ile BİREBİR aynı değer
-- ============================================================

-- 1) Gerekli eklentiler (zaten açıksa bir şey yapmaz)
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;
create extension if not exists pg_net with schema extensions;

-- 2) Adres ve anahtar Supabase Vault'ta şifreli saklanır
do $$
declare
  v_url text := rtrim('__SITE_ADRESI__', '/') || '/api/aile-senkron';
  v_key text := '__GIZLI_ANAHTAR__';
  v_id  uuid;
begin
  -- (Kontrol, yer tutucunun tam metnini içermez; böylece doldurulunca bozulmaz.)
  if position('SITE_ADRESI' in v_url) > 0 or position('GIZLI_ANAHTAR' in v_key) > 0 or length(v_key) < 24 then
    raise exception 'Önce site adresini ve gizli anahtarı kendi bilgilerinizle değiştirin (anahtar en az 24 karakter).';
  end if;
  if v_url not like 'https://%' then
    raise exception 'Site adresi https:// ile başlamalı (ör. https://veli.corluders.com)';
  end if;

  select id into v_id from vault.secrets where name = 'derstakip_senkron_url';
  if v_id is null then
    perform vault.create_secret(v_url, 'derstakip_senkron_url', 'DersTakip ek süre senkron adresi');
  else
    perform vault.update_secret(v_id, v_url);
  end if;

  select id into v_id from vault.secrets where name = 'derstakip_senkron_anahtari';
  if v_id is null then
    perform vault.create_secret(v_key, 'derstakip_senkron_anahtari', 'DersTakip ek süre senkron anahtarı');
  else
    perform vault.update_secret(v_id, v_key);
  end if;
end $$;

-- 3) Dakikalık görev (aynı adla tekrar çalıştırılırsa eskisinin yerine geçer)
select cron.schedule(
  'derstakip-ek-sure',
  '* * * * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'derstakip_senkron_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'derstakip_senkron_anahtari')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  )
  where exists (
          select 1
          from public.fs_credits c
          join public.fs_links l on l.student_id = c.student_id and l.enabled
          join public.fs_connections k on k.owner_id = c.owner_id and k.status = 'ok'
          where c.status in ('hazir', 'ayrildi'))
     or to_char(now() at time zone 'Europe/Istanbul', 'HH24:MI') = '04:00';
  $cron$
);

-- ------------------------------------------------------------
-- Faydalı sorgular:
--   Görev kayıtlı mı?          select jobname, schedule, active from cron.job;
--   Son çalışmalar:            select status, start_time, return_message from cron.job_run_details order by start_time desc limit 10;
--   Siteden gelen yanıtlar:    select status_code, content, created from net._http_response order by created desc limit 10;
--   Görevi kaldırmak için:     select cron.unschedule('derstakip-ek-sure');
-- ------------------------------------------------------------
