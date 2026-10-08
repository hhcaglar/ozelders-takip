// Testler için Supabase benzeri bir PostgreSQL ortamı kurar.
// Gerçek bir PostgreSQL (embedded-postgres) başlatır; Supabase'in roller,
// auth.uid() ve varsayılan yetki davranışını taklit eder, ardından
// supabase/schema.sql dosyasını olduğu gibi çalıştırır.
//
// Gereken geçici paketler (package.json'a EKLENMEZ):
//   npm install --no-save embedded-postgres pg
import { readFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', '..')

async function loadDeps() {
  try {
    const { default: EmbeddedPostgres } = await import('embedded-postgres')
    const pg = await import('pg')
    return { EmbeddedPostgres, pg: pg.default ?? pg }
  } catch {
    console.error(
      '\nBu test için geçici paketler gerekli. Şunu çalıştırın:\n' +
        '  npm install --no-save embedded-postgres pg\n'
    )
    process.exit(2)
  }
}

// Supabase'in hazır sunduğu ortamın küçük bir taklidi
const SUPABASE_MOCK = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    )::uuid
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant select on auth.users to service_role;

  -- Supabase, public şemasındaki yeni nesnelere bu rollerin hepsine yetki verir.
  -- schema.sql'deki "revoke" satırlarının gerçekten işe yaradığını görmek için
  -- aynı davranışı burada da kuruyoruz.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`

export async function startTestDb({ port = 54000 + Math.floor(Math.random() * 900) } = {}) {
  const { EmbeddedPostgres, pg } = await loadDeps()
  const dataDir = mkdtempSync(path.join(tmpdir(), 'dt-pg-'))
  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    persistent: false,
    onLog: () => {},
    onError: () => {},
  })
  await server.initialise()
  await server.start()

  const pool = new pg.Pool({
    host: 'localhost',
    port,
    user: 'postgres',
    password: 'postgres',
    database: 'postgres',
    max: 6,
  })
  // Kapanışta sunucu boştaki bağlantıları sonlandırınca gelen hatalar süreci
  // çökertmesin (pg-pool'un bilinen davranışı; test sonuçlarını etkilemez)
  pool.on('error', () => {})

  await pool.query(SUPABASE_MOCK)
  await pool.query(readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8'))
  // Şema iki kez çalıştırılabilmeli (idempotent olduğu belgelenmiş)
  await pool.query(readFileSync(path.join(root, 'supabase/schema.sql'), 'utf8'))

  /**
   * Bir sorguyu belirli bir Supabase rolüyle çalıştırır.
   * role: 'anon' | 'authenticated' | 'service_role' | 'postgres'
   */
  async function as(role, uid, sql, params = []) {
    const client = await pool.connect()
    try {
      await client.query('begin')
      if (role !== 'postgres') {
        await client.query(`set local role ${role}`)
        const claims = uid ? JSON.stringify({ sub: uid, role }) : JSON.stringify({ role })
        await client.query(`select set_config('request.jwt.claims', $1, true)`, [claims])
      }
      const res = await client.query(sql, params)
      await client.query('commit')
      return res
    } catch (e) {
      await client.query('rollback').catch(() => {})
      throw e
    } finally {
      client.release()
    }
  }

  async function stop() {
    await pool.end().catch(() => {})
    await server.stop().catch(() => {})
    rmSync(dataDir, { recursive: true, force: true })
  }

  return { pool, as, stop, port }
}

// Küçük test çatısı
export function createRunner(title) {
  let passed = 0
  let failed = 0
  console.log(`\n${title}`)
  return {
    ok(name, cond, detail) {
      if (cond) {
        passed++
        console.log(`  ✅ ${name}`)
      } else {
        failed++
        console.log(`  ❌ ${name}${detail !== undefined ? ` → ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`)
      }
    },
    async throws(name, fn, pattern) {
      try {
        await fn()
        failed++
        console.log(`  ❌ ${name} → hata bekleniyordu ama gelmedi`)
      } catch (e) {
        const msg = String(e?.message ?? e)
        if (!pattern || pattern.test(msg)) {
          passed++
          console.log(`  ✅ ${name}`)
        } else {
          failed++
          console.log(`  ❌ ${name} → beklenmeyen hata: ${msg}`)
        }
      }
    },
    section(name) {
      console.log(`\n  — ${name}`)
    },
    summary() {
      console.log(`\n${failed === 0 ? 'TÜM TESTLER GEÇTİ' : `${failed} TEST BAŞARISIZ`} (${passed} geçti)`)
      return failed
    },
  }
}
