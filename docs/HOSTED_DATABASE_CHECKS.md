# Running the four hosted-database checks

Four server tests only run against a real Supabase database. In CI they are skipped, because CI has no keys. This page is how to run them once, by hand, against the team's database, and how to record the result.

It takes about 20 minutes. There is no deadline on it; do it when you have a quiet half hour.

## What the four checks are

| Test | File | What it proves |
| --- | --- | --- |
| TP-40 | `server/src/__tests__/store-contract.test.ts` | `getSemester` from Supabase has the same shape as the in-memory store |
| TP-41 | same file | Marking a task done is still there when a new store instance reads it. This one **writes**, then puts the original value back |
| TP-42 | same file | An unknown task id comes back as `null`, not an error |
| TP-36 | `server/src/__tests__/weekly-capacity.test.ts` | The weekly capacity is still there after a fresh store reads it. This one **writes**, then puts the original value back |

TP-41 and TP-36 only run when `RUN_SUPABASE_WRITE_TESTS=true`. TP-40 and TP-42 run whenever the three variables below are set.

## Ground rules

- **The secret key stays on your computer.** Never put it in a PR, an issue, a chat, a screenshot, a test, or a file git would commit. A test (`no-secrets.test.ts`) fails if a key-shaped string is committed.
- **Use a throwaway test student**, created in step 2 and deleted in step 5. Never point these tests at a real student's account.
- **Never run `db/reset.sql`** on the team's database. It deletes every account and every saved review.
- Run these commands in **PowerShell**, from the `server` folder, unless a step says otherwise.

## Step 1: check the database is up to date

Open the Supabase dashboard, then **SQL Editor**, and run each of these.

```sql
select column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'tasks' and column_name = 'user_id';
```

It must return **one row**.

```sql
select to_regclass('public.student_settings') as settings_table,
       to_regprocedure('public.load_sample_semester(text,text[],jsonb,numeric)') as sample_function;
```

Both columns must be filled in (not empty).

```sql
select count(*) as courses from courses;
```

It should say 5 or more.

**If any of these fail,** stop and tell the team. It means the database is missing the per-student migrations, `db/migration_own_semester.sql` and then `db/migration_course_catalog.sql` (in that order). Do not apply them on your own: the first one deletes tasks that have no owner. Say which check failed and what it returned.

## Step 2: make the throwaway test student

In the SQL Editor:

```sql
insert into "user" ("id", "name", "email")
values ('hosted-checks-student', 'Hosted Checks', 'hosted-checks@example.com');
```

The student's id is `hosted-checks-student`. If it says the email already exists, an earlier run left it behind; go to step 5 first and then start again.

## Step 3: give that student the sample semester

The checks need a student who already has the sample (task `262-2` must exist for them). Save this as `load-sample.local.ts` **inside the `server` folder**. It is only for this run: **do not commit it** and delete it in step 5.

```ts
import { SupabaseStore } from './src/data/supabase-store';

new SupabaseStore(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!)
  .loadSample(process.env.SUPABASE_TEST_USER_ID!)
  .then((semester) =>
    console.log(
      semester
        ? `loaded: ${semester.tasks.length} tasks, ${semester.courses.length} courses`
        : 'not loaded: this student already has courses or tasks'
    )
  )
  .catch((error) => console.error('failed:', error.message));
```

Set the four variables for this PowerShell window (they disappear when you close it). Use the team's project URL and the team's **secret** key (it starts with `sb_secret_`; the anon key will not work):

```powershell
$env:SUPABASE_URL = "https://gyrruunfpwoexoncceel.supabase.co"
$env:SUPABASE_SECRET_KEY = "paste the secret key here"
$env:SUPABASE_TEST_USER_ID = "hosted-checks-student"
$env:RUN_SUPABASE_WRITE_TESTS = "true"
```

Then run the script once:

```powershell
node --import tsx load-sample.local.ts
```

It should print `loaded: ... tasks, ... courses`. If it says "not loaded", the student already has data: go to step 5, then redo steps 2 and 3.

## Step 4: run the four checks

In the same PowerShell window:

```powershell
npx jest store-contract weekly-capacity --verbose --maxWorkers=2
```

You are looking for these four lines with a check mark, not "skipped" and not a cross:

- Under `Store Contract`, in the SupabaseStore group: `TP-40: returns a semester with the correct shape`
- Same group: `TP-42: returns null for an unknown task ID`
- Same group: `TP-41: task updates persist in Supabase across store instances`
- Under `TP-36: Supabase keeps the capacity across store instances`: `reads back the new capacity from a fresh store`

The in-memory tests in the same two files run too and should pass as well. Copy the output from the terminal into a text file. It contains test names and counts, not keys, but read it once before you share it.

The two write tests put the original values back in a `finally` block, so a failed run does not leave the student changed. Because the student is thrown away in step 5 anyway, nothing here touches real data.

## Step 5: clean up

In the SQL Editor (this also deletes the student's tasks, enrollments and settings):

```sql
delete from "user" where "id" = 'hosted-checks-student';
```

In PowerShell:

```powershell
Remove-Item load-sample.local.ts
Remove-Item Env:SUPABASE_URL, Env:SUPABASE_SECRET_KEY, Env:SUPABASE_TEST_USER_ID, Env:RUN_SUPABASE_WRITE_TESTS
git status
```

`git status` should show nothing new. If it lists `load-sample.local.ts` or anything else you did not mean to change, do not commit it.

## Step 6: record the run

Add one row under the existing line in `docs/TEST_PLAN_SERVER_API.md` that says TP-41 passed against Supabase. Use this shape:

| Date | Who ran it | Tests | Result | Notes |
| --- | --- | --- | --- | --- |
| (date) | (your name) | TP-36, TP-40, TP-41, TP-42 against the team's Supabase project, test student deleted afterwards | (4 passed, or what failed) | `RUN_SUPABASE_WRITE_TESTS=true`; commit (the short hash of the commit you ran) |

Paste the jest summary (the lines with the four check marks and the totals) into the pull request or the issue. Leave the key out.

## If something goes wrong

| What you see | What it means | What to do |
| --- | --- | --- |
| The four tests still say "skipped" | The variables are not set in this PowerShell window. Jest does not read `server/.env` | Set the four `$env:` lines again in the same window, then rerun |
| `Invalid API key` or a 401 | The wrong key, or a stray quote or space | Use the secret key (`sb_secret_...`), not the anon key |
| `relation ... does not exist` or `column ... does not exist` | The database is not up to date | Go back to step 1 and tell the team |
| `violates foreign key constraint` | The test student was not created | Redo step 2 |
| TP-41 says `Sample task not found` | The student has no sample, or `262-2` is missing | Redo step 3; check the seed ran (step 1, third query) |
| A timeout | A free project that has been idle wakes slowly | Open the project in the dashboard, wait a minute, rerun |
| The project is paused | Free projects pause after a week unused | Unpause it from the dashboard |
| You pasted the key somewhere it should not be | It is now exposed | Tell TJ (the project owner) to rotate the key in the dashboard, then update your own copy |
