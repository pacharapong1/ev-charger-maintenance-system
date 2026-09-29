-- =============================================================================
-- EV-ChargeOps : demo accounts
-- Target       : Supabase (PostgreSQL 15+)
-- Run AFTER     : 01_schema.sql, 02_rls.sql
-- =============================================================================
--
-- This project authenticates on its own, so the accounts are rows in
-- public.profiles and nothing is written to the auth schema. The previous
-- version of this file inserted into auth.users and relied on a trigger; that
-- approach is gone.
--
-- Passwords are hashed with pgcrypto's bcrypt. Password123! is a demo password
-- for a course submission and must never be reused anywhere real.
--
-- Idempotent: the UUIDs are fixed and every insert is an upsert, so re-running
-- resets the demo passwords and roles back to the values below.
--
-- One caveat on re-running against a database seeded from the previous version
-- of this file: the third row used to be tech2, a second Technician, and it now
-- becomes eng1, an Engineer. The upsert is keyed on id, so the same row is
-- renamed and reassigned. That is fine for demo data, but it does mean any
-- maintenance record already pointing at that id is now attributed to an
-- Engineer. Change the UUID if you want to keep tech2 as well.
--
-- Read this before running it on a database that already holds real accounts.
-- The conflict target is (id), so this file only ever rewrites the four fixed
-- demo rows. It does not touch anyone else. But if a real account already holds
-- one of these usernames under a *different* id, the unique constraint on
-- username rejects the statement and all four inserts roll back together.
-- That is the intended outcome: check the username list on the last line
-- beforehand, and rename the real account if it collides. Nothing is written
-- on conflict with a username.
--
-- One account per role. tech1 proves the Technician workflow, eng1 the Engineer
-- one, and view1 that a Viewer really does see no buttons at all. All four use
-- the same demo password.

insert into public.profiles (id, username, full_name, role, password_hash)
values
  (
    $$11111111-1111-4111-8111-111111111111$$::uuid,
    $$admin$$,
    $$Natthawut Srisuwan$$,
    $$Admin$$,
    extensions.crypt($$Password123!$$, extensions.gen_salt($$bf$$))
  ),
  (
    $$22222222-2222-4222-8222-222222222222$$::uuid,
    $$tech1$$,
    $$Somchai Jaidee$$,
    $$Technician$$,
    extensions.crypt($$Password123!$$, extensions.gen_salt($$bf$$))
  ),
  (
    $$33333333-3333-4333-8333-333333333333$$::uuid,
    $$eng1$$,
    $$Piyaporn Wongtong$$,
    $$Engineer$$,
    extensions.crypt($$Password123!$$, extensions.gen_salt($$bf$$))
  ),
  (
    $$44444444-4444-4444-8444-444444444444$$::uuid,
    $$view1$$,
    $$Anong Chaiyasit$$,
    $$Viewer$$,
    extensions.crypt($$Password123!$$, extensions.gen_salt($$bf$$))
  )
on conflict (id) do update
set username      = excluded.username,
    full_name     = excluded.full_name,
    role          = excluded.role,
    password_hash = excluded.password_hash;

-- Read-only listing for confirming the result. password_hash is deliberately
-- absent: SELECT on it is revoked in 02_rls.sql.
select id, username, full_name, role from public.profiles order by role, username;
