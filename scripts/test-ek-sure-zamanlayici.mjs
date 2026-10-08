// supabase/ek-sure-zamanlayici.sql testi — Vault / pg_cron / pg_net taklitleriyle.
// Arayüzün kullandığı fillSchedulerSql() ile doldurulmuş SQL çalıştırılır.
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { startTestDb, createRunner } from './lib/test-db.mjs'
import { fillSchedulerSql, generateSecret } from '../src/lib/ekSureKurulum.js'

const root = path.resolve(import.meta.dirname, '..')
const template = readFileSync(path.join(root, 'supabase/ek-sure-zamanlayici.sql'), 'utf8')

// Gerçek eklentiler yerel PostgreSQL'de yok → aynı imzalı küçük taklitler
const STUBS = `
  create schema vault;
  create table vault.secrets (id uuid primary key default gen_random_uuid(), name text unique, secret text, description text);
  create view vault.decrypted_secrets as select id, name, secret as decrypted_secret, description from vault.secrets;
  create function vault.create_secret(new_secret text, new_name text default null, new_description text default '')
    returns uuid language sql as $$ insert into vault.secrets (name, secret, description) values (new_name, new_secret, new_description) returning id $$;
  create function vault.update_secret(secret_id uuid, new_secret text default null, new_name text default null)
    returns void language sql as $$ update vault.secrets set secret = coalesce(new_secret, secret) where id = secret_id $$;

  create schema cron;
  create table cron.job (jobname text primary key, schedule text, command text);
  create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as $$
    insert into cron.job values (job_name, schedule, command)
    on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command;
    select 1::bigint $$;

  create schema net;
  create table net.calls (url text, headers jsonb, body jsonb, timeout int);
  create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
                                headers jsonb default '{}'::jsonb, timeout_milliseconds int default 5000)
    returns bigint language sql as $$ insert into net.calls values (url, headers, body, timeout_milliseconds); select 1::bigint $$;
`
// "create extension" satırları taklit ortamda çalıştırılamaz
const runnable = (sql) => sql.replace(/^create extension.*$/gim, '-- (testte atlandı) $&')

const db = await startTestDb()
const t = createRunner('Ek Süre — zamanlayıcı SQL testleri')
try {
  await db.pool.query(STUBS)

  await t.throws('Doldurulmamış şablon anlaşılır hatayla durur', () => db.pool.query(runnable(template)), /kendi bilgilerinizle/)
  await t.throws('http:// adres reddedilir', () => db.pool.query(runnable(fillSchedulerSql(template, 'http://site.com', generateSecret()))), /https/)
  await t.throws('Kısa anahtar reddedilir', () => db.pool.query(runnable(fillSchedulerSql(template, 'https://site.com', 'kisa'))), /24 karakter/)

  const secret = generateSecret()
  t.ok('Üretilen anahtar 40 karakter, yalnızca harf/rakam', /^[A-Za-z0-9]{40}$/.test(secret))
  const filled = fillSchedulerSql(template, 'https://veli.corluders.com/', secret)
  t.ok('Doldurulan SQL\'de yer tutucu değer kalmadı', !filled.includes("'__SITE_ADRESI__'") && !filled.includes("'__GIZLI_ANAHTAR__'"))
  await db.pool.query(runnable(filled))
  let s = (await db.pool.query(`select name, decrypted_secret from vault.decrypted_secrets order by name`)).rows
  t.ok('Vault: adres (sondaki / temizlenmiş) ve anahtar kaydedildi', s.length === 2 && s.find((x) => x.name === 'derstakip_senkron_url')?.decrypted_secret === 'https://veli.corluders.com/api/aile-senkron' && s.find((x) => x.name === 'derstakip_senkron_anahtari')?.decrypted_secret === secret, s)
  const job = (await db.pool.query(`select * from cron.job`)).rows
  t.ok('Dakikalık görev kaydedildi', job.length === 1 && job[0].jobname === 'derstakip-ek-sure' && job[0].schedule === '* * * * *')

  const secret2 = generateSecret()
  await db.pool.query(runnable(fillSchedulerSql(template, 'https://veli.corluders.com', secret2)))
  s = (await db.pool.query(`select name, decrypted_secret from vault.decrypted_secrets`)).rows
  t.ok('Tekrar çalıştırmak çoğaltmaz, anahtarı günceller', s.length === 2 && s.find((x) => x.name === 'derstakip_senkron_anahtari').decrypted_secret === secret2)
  t.ok('Görev hâlâ tek', (await db.pool.query(`select count(*)::int n from cron.job`)).rows[0].n === 1)

  // Görev komutunu cron'un yapacağı gibi çalıştır
  const command = job[0].command
  const runJob = async () => {
    await db.pool.query('delete from net.calls')
    await db.pool.query(command)
    return (await db.pool.query('select * from net.calls')).rows
  }
  const isFourAm = (await db.pool.query(`select to_char(now() at time zone 'Europe/Istanbul', 'HH24:MI') = '04:00' as v`)).rows[0].v
  let calls = await runJob()
  t.ok('Hak yokken siteye istek GİTMEZ', isFourAm || calls.length === 0, calls)

  const T = randomUUID()
  const S = randomUUID()
  await db.pool.query(`insert into auth.users (id) values ($1)`, [T])
  await db.pool.query(`insert into public.students (id, owner_id, data) values ($1, $2, '{"name":"Elif"}')`, [S, T])
  await db.pool.query(`insert into public.fs_connections (owner_id, refresh_token) values ($1, 'rt')`, [T])
  await db.pool.query(`insert into public.fs_links (student_id, owner_id, ms_child_id) values ($1, $2, '1')`, [S, T])
  await db.pool.query(`insert into public.fs_credits (student_id, owner_id, title) values ($1, $2, 'ödev')`, [S, T])

  calls = await runJob()
  t.ok('Hazır hak varken siteye 1 istek gider', calls.length === 1)
  t.ok('İstek doğru adrese, doğru anahtarla gider', calls[0]?.url === 'https://veli.corluders.com/api/aile-senkron' && calls[0]?.headers?.Authorization === `Bearer ${secret2}`, calls[0])
  t.ok('Zaman aşımı 25 sn', calls[0]?.timeout === 25000)

  await db.pool.query(`update public.fs_links set enabled = false`)
  calls = await runJob()
  t.ok('Otomatik onay kapalıysa istek gitmez', isFourAm || calls.length === 0)
  await db.pool.query(`update public.fs_links set enabled = true; update public.fs_connections set status = 'yeniden_giris'`)
  calls = await runJob()
  t.ok('Microsoft oturumu düşmüşse istek gitmez (boşuna çağrı yok)', isFourAm || calls.length === 0)
} catch (e) {
  t.ok('Beklenmeyen hata olmadan tamamlandı', false, e?.stack || String(e))
} finally {
  await db.stop()
}
process.exit(t.summary() === 0 ? 0 : 1)
