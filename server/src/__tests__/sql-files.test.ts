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
const read = (name: string) => fs.readFileSync(path.join(dbDir, name), 'utf8');

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
