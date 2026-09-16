-- A simple append-only audit trail for the sportsbook: account creation,
-- bets/parlays placed, and the new admin actions (balance adjustments,
-- forced bet outcomes, account deletions) all write one row here so
-- there's a single chronological feed of "everything that happened" --
-- shown on the new Activity tab.
--
-- Run once in the Supabase SQL editor.

create table if not exists sb_activity_log (
  id uuid primary key default gen_random_uuid(),
  season text not null,
  event_type text not null, -- account_created | bet_placed | parlay_placed | pickem_submitted | balance_adjusted | bet_overridden | account_deleted
  actor text,               -- the manager_name responsible (the bettor for their own actions, 'Admin' for admin actions)
  description text not null,
  created_at timestamptz not null default now()
);
create index if not exists sb_activity_log_season_idx on sb_activity_log(season);
create index if not exists sb_activity_log_created_at_idx on sb_activity_log(created_at desc);

alter table sb_activity_log enable row level security;
drop policy if exists "public_all" on sb_activity_log;
create policy "public_all" on sb_activity_log for all using (true) with check (true);
