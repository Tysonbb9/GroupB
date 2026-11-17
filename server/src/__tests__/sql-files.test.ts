import fs from 'node:fs';
import path from 'node:path';

/**
 * The SQL in server/db/ can't run here (no Postgres in CI), so these check
 * that the files agree with each other and with the Supabase store:
 * building from scratch (schema.sql) gives the same tables as the
 * migration, reset.sql removes all of them, and every table and column the
 * store uses exists.
 */

const dbDir = path.join(__dirname, '..', '..', 'db');
const read = (name: string) => fs.readFileSync(path.join(dbDir, name), 'utf8').replace(/\r\n/g, '\n');

const schema = read('schema.sql');
const reset = read('reset.sql');
const migration144 = read('migration_144_course_tables.sql');
const store = fs.readFileSync(path.join(__dirname, '..', 'data', 'supabase-store.ts'), 'utf8');

const NEW_TABLES = ['syllabi', 'grade_weights', 'course_policies', 'course_checkins', 'week_hours'];

/** The text between `create table <name> (` and its closing `);`, without comments. */
function tableBody(sql: string, table: string): string | null {
  const match = new RegExp(`create table (?:if not exists )?${table} \\(([\\s\\S]*?)\\n\\);`).exec(sql);
  if (!match) return null;
  return match[1]
    .split('\n')
    .map((line) => line.replace(/--.*$/, '').trim())
    .filter(Boolean)
    .join('\n');
}

/** Every table schema.sql creates. */
function tablesIn(sql: string): string[] {
  return [...sql.matchAll(/create table (?:if not exists )?("?\w+"?) \(/g)].map((m) => m[1]);
}

describe('SQL file line endings', () => {
  it.each(['\n', '\r\n'])('reads %j line endings without weakening transaction checks', (ending) => {
    const migration = '-- A migration.\nbegin;\nselect 1;\ncommit;\n';
    const transaction = /^(--.*\n|\s)*begin;[\s\S]*commit;$/;
    const fileRead = jest.spyOn(fs, 'readFileSync');
    try {
      fileRead.mockReturnValueOnce(migration.replace(/\n/g, ending));
      const complete = read('migration_144_course_tables.sql');
      expect(complete).toBe(migration);
      expect(complete.trim()).toMatch(transaction);

      fileRead.mockReturnValueOnce(migration.replace('commit;\n', '').replace(/\n/g, ending));
      expect(read('migration_144_course_tables.sql').trim()).not.toMatch(transaction);
    } finally {
      fileRead.mockRestore();
    }
  });
});

describe('migration_144_course_tables.sql (#144)', () => {
  it.each(NEW_TABLES)('creates %s, safe to run twice', (table) => {
    expect(migration144).toMatch(new RegExp(`create table if not exists ${table} \\(`));
  });

  it('runs in one transaction', () => {
    expect(migration144.trim()).toMatch(/^(--.*\n|\s)*begin;[\s\S]*commit;$/);
  });

  it('does not touch the tables that hold data already', () => {
    for (const table of ['semester', 'courses', 'tasks', 'reviews', '"user"', 'enrollments']) {
      expect(migration144).not.toMatch(new RegExp(`(alter|drop|truncate|delete from|update|insert into) (table )?${table}\\b`, 'i'));
    }
  });

  it.each(NEW_TABLES)('turns Row Level Security on for %s', (table) => {
    expect(migration144).toMatch(new RegExp(`alter table ${table}\\s+enable row level security;`));
  });

  it('only lets the server call replace_grade_weights, not the public key', () => {
    expect(migration144).toMatch(/revoke execute on function replace_grade_weights\(text, jsonb\) from public, anon, authenticated;/);
    expect(migration144).toMatch(/grant execute on function replace_grade_weights\(text, jsonb\) to service_role;/);
  });

  it('pins the function search_path, as Supabase advises', () => {
    expect(migration144).toMatch(/function replace_grade_weights[\s\S]*?set search_path = public/);
  });
});

describe('schema.sql builds the same database from scratch', () => {
  it.each(NEW_TABLES)('defines %s exactly as the migration does', (table) => {
    const fromScratch = tableBody(schema, table);
    expect(fromScratch).not.toBeNull();
    expect(fromScratch).toBe(tableBody(migration144, table));
  });

  it('defines replace_grade_weights exactly as the migration does', () => {
    const fn = (sql: string) => /create or replace function replace_grade_weights[\s\S]*?\$\$;/.exec(sql)?.[0];
    expect(fn(schema)).toBeDefined();
    expect(fn(schema)).toBe(fn(migration144));
  });

  it.each(NEW_TABLES)('turns Row Level Security on for %s', (table) => {
    expect(schema).toMatch(new RegExp(`alter table ${table}\\s+enable row level security;`));
  });
});

describe('reset.sql', () => {
  it('drops every table schema.sql creates, so a rebuild starts clean', () => {
    const dropped = [...reset.matchAll(/drop table if exists ([^;]+);/g)].flatMap((m) =>
      m[1].split(',').map((name) => name.trim())
    );
    for (const table of tablesIn(schema)) {
      expect(dropped).toContain(table);
    }
  });

  it('drops the course details before courses and "user", which they point at', () => {
    // Only the drop statements count, not the comments that mention the tables.
    const drops = [...reset.matchAll(/^drop table if exists [^;]+;/gm)].map((m) => m[0]).join('\n');
    const order = (name: string) => drops.search(new RegExp(`[ ,]${name.replace(/"/g, '"')}[,;]`));
    for (const table of NEW_TABLES) {
      expect(order(table)).toBeGreaterThan(-1);
      expect(order(table)).toBeLessThan(order('courses'));
      expect(order(table)).toBeLessThan(order('"user"'));
    }
  });
});

describe('the Supabase store and the SQL agree', () => {
  it('uses only tables that schema.sql creates', () => {
    const used = [...store.matchAll(/\.from\('(\w+)'\)/g)].map((m) => m[1]);
    expect(used.length).toBeGreaterThan(0);
    for (const table of new Set(used)) {
      expect(tablesIn(schema)).toContain(table);
    }
  });

  it.each([
    ['syllabi', ['course_id', 'text']],
    ['grade_weights', ['course_id', 'position', 'name', 'detail', 'percent']],
    ['course_policies', ['course_id', 'late_percent_per_day', 'late_max_days', 'drop_rule']],
    ['course_checkins', ['user_id', 'course_id', 'answer', 'answered_at']],
    ['week_hours', ['user_id', 'week', 'hours']],
  ])('%s has every column the store reads or writes', (table, columns) => {
    const body = tableBody(schema, table) ?? '';
    for (const column of columns) {
      expect(body).toMatch(new RegExp(`^${column}\\s`, 'm'));
    }
  });

  it('the conflict targets the store upserts on are each a primary key', () => {
    expect(tableBody(schema, 'syllabi')).toMatch(/course_id\s+text primary key/);
    expect(tableBody(schema, 'course_policies')).toMatch(/course_id\s+text primary key/);
    expect(tableBody(schema, 'course_checkins')).toMatch(/primary key \(user_id, course_id\)/);
    expect(tableBody(schema, 'week_hours')).toMatch(/primary key \(user_id, week\)/);
  });

  it('has no column or rule the card and the AI screens did not ask for', () => {
    // types.ts: a field that no function uses and no screen draws does not belong yet.
    expect(tableBody(schema, 'syllabi')).not.toMatch(/read_at/);
    expect(schema).not.toMatch(/grade_weights_name_once/);
    expect(migration144).not.toMatch(/grade_weights_name_once|read_at/);
  });

  it('the check-in answers match the code', () => {
    expect(tableBody(schema, 'course_checkins')).toMatch(/check \(answer in \('on-schedule', 'changed', 'none-of-these'\)\)/);
  });

  it('the week hours limits match the code: weeks 1 to 15, hours 1 to 80', () => {
    expect(tableBody(schema, 'week_hours')).toMatch(/check \(week between 1 and 15\)/);
    expect(tableBody(schema, 'week_hours')).toMatch(/check \(hours between 1 and 80\)/);
  });
});

// The upgrade and a fresh database must give the same student-owned data model.
describe('student semester migration', () => {
  const migration = read('migration_own_semester.sql');
  it('runs in one transaction and removes only ownerless tasks', () => {
    expect(migration.trim()).toMatch(/^(--.*\n|\s)*begin;[\s\S]*commit;$/);
    expect(migration).toContain('delete from tasks where user_id is null;');
    expect(migration).toContain('add column if not exists user_id');
    expect(migration).toContain('drop constraint if exists tasks_pkey');
    expect(migration).not.toMatch(/delete from (reviews|courses|enrollments)/i);
    expect(migration).toContain('primary key (user_id, id)');
    expect(tableBody(schema, 'tasks')).toContain('primary key (user_id, id)');
    expect(schema).toContain('foreign key (user_id) references "user" (id) on delete cascade');
  });
  it('creates the same private student settings from scratch or on upgrade', () => {
    expect(tableBody(schema, 'student_settings')).toBe(tableBody(migration, 'student_settings'));
    expect(migration).toContain('alter table student_settings enable row level security;');
    expect(schema).toContain('alter table student_settings enable row level security;');
    expect(reset).toContain('student_settings');
  });
  it('uses the same atomic sample function with student locking and restricted access', () => {
    const fn = (sql: string) => /create or replace function load_sample_semester[\s\S]*?\$\$;/.exec(sql)?.[0];
    expect(fn(schema)).toBeDefined();
    expect(fn(schema)).toBe(fn(migration));
    expect(migration).toContain('where id = p_user_id for update');
    expect(migration).toContain('values (p_user_id, p_weekly_capacity)');
    expect(migration).toContain('on conflict (user_id) do nothing;');
    expect(migration).toContain('from enrollments where user_id = p_user_id');
    expect(migration).toContain('from tasks where user_id = p_user_id');
    expect(migration).toContain('revoke execute on function load_sample_semester(text, text[], jsonb, numeric) from public, anon, authenticated;');
    expect(reset).toContain('drop function if exists load_sample_semester(text, text[], jsonb, numeric);');
    expect(read('seed.sql')).not.toMatch(/insert into tasks/i);
  });
});

describe('course catalog migration', () => {
  const migration = read('migration_course_catalog.sql');
  it('backfills and enforces code identity transactionally without deleting or merging courses', () => {
    expect(migration.trim()).toMatch(/^(--.*\n|\s)*begin;[\s\S]*commit;$/);
    expect(migration).toContain('add column if not exists code_key text');
    expect(migration).toContain("regexp_replace(upper(code), '[[:space:]._-]', '', 'g')");
    expect(migration).toContain('create unique index if not exists courses_code_key_unique on courses (code_key)');
    expect(schema).toContain('create unique index courses_code_key_unique on courses (code_key)');
    expect(migration).not.toMatch(/delete from|drop table|truncate/i);
    expect(tableBody(schema, 'courses')).toContain('code_key');
  });
  it.each(['search_course_catalog', 'create_catalog_course'])('defines %s identically for upgrades and fresh databases', name => {
    const fn = (sql: string) => new RegExp(`create or replace function ${name}[\\s\\S]*?\\$\\$;`).exec(sql)?.[0];
    expect(fn(schema)).toBeDefined();
    expect(fn(schema)).toBe(fn(migration));
    expect(migration).toMatch(new RegExp(`revoke execute on function ${name}[^;]+from public, anon, authenticated;`));
    expect(reset).toContain(`drop function if exists ${name}`);
  });
  it('handles uniqueness collisions and enrolls only after a successful insert', () => {
    expect(migration).toContain('exception when unique_violation then');
    expect(migration).toContain('where c.code_key = p_code_key');
    expect(migration).toContain("candidate := p_id_base || '-' || suffix");
    expect(migration).toContain('insert into enrollments (user_id, course_id) values (p_user_id, saved.id)');
  });
  it('matches route length limits and uses bounded literal search with deterministic priority', () => {
    for (const sql of [schema, migration]) {
      expect(sql).toContain('char_length(btrim(code)) between 1 and 40');
      expect(sql).toContain('char_length(btrim(name)) between 1 and 200');
      expect(sql).toContain('limit 10;');
      expect(sql).toContain("p_code_query <> '' and c.code_key = p_code_query then 0");
      expect(sql).toContain('starts_with(c.code_key, p_code_query) then 1');
      expect(sql).toContain('strpos(lower(c.name), lower(p_name_query))');
    }
  });
});

describe('migration_164_calendar_link.sql (#164)', () => {
  const migration164 = read('migration_164_calendar_link.sql');

  it('creates calendar_links, safe to run twice, in one transaction', () => {
    expect(migration164).toMatch(/create table if not exists calendar_links \(/);
    expect(migration164.trim()).toMatch(/^(--.*\n|\s)*begin;[\s\S]*commit;$/);
  });

  it('touches no other table', () => {
    for (const table of ['semester', 'courses', 'tasks', 'reviews', '"user"', 'enrollments', 'week_hours']) {
      expect(migration164).not.toMatch(new RegExp(`(alter|drop|truncate|delete from|update|insert into) (table )?${table}\\b`, 'i'));
    }
  });

  it('keeps one link per student, deleted with the student, and only https', () => {
    const body = tableBody(migration164, 'calendar_links') ?? '';
    expect(body).toMatch(/user_id\s+text primary key references "user" \("id"\) on delete cascade/);
    expect(body).toMatch(/url\s+text not null check \(url like 'https:\/\/%'\)/);
  });

  it('turns Row Level Security on, so the public key cannot read the secret link', () => {
    expect(migration164).toMatch(/alter table calendar_links\s+enable row level security;/);
    expect(schema).toMatch(/alter table calendar_links\s+enable row level security;/);
  });

  it('schema.sql defines calendar_links exactly as the migration does', () => {
    expect(tableBody(schema, 'calendar_links')).not.toBeNull();
    expect(tableBody(schema, 'calendar_links')).toBe(tableBody(migration164, 'calendar_links'));
  });

  it('reset.sql drops it before "user", which it points at', () => {
    const drops = [...reset.matchAll(/^drop table if exists [^;]+;/gm)].map((m) => m[0]).join('\n');
    expect(drops.search(/[ ,]calendar_links[,;]/)).toBeGreaterThan(-1);
    expect(drops.search(/[ ,]calendar_links[,;]/)).toBeLessThan(drops.search(/[ ,]"user"[,;]/));
  });

  it('has every column the Supabase store reads or writes', () => {
    const body = tableBody(schema, 'calendar_links') ?? '';
    for (const column of ['user_id', 'url', 'saved_at']) {
      expect(body).toMatch(new RegExp(`^${column}\\s`, 'm'));
    }
    expect(store).toMatch(/from\('calendar_links'\)/);
  });
});
