-- Forgot-PIN flow: a bettor requests a new PIN, which sits pending until an
-- admin approves it (only then does gb_accounts.pin actually change) or
-- denies it. Approvals/denials happen from the sportsbook's Activity tab.
--
-- Run once in the Supabase SQL editor.

create table if not exists sb_pin_resets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid references gb_accounts(id) on delete cascade not null,
  requested_pin text not null,
  status text not null default 'pending', -- pending | approved | denied
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists sb_pin_resets_status_idx on sb_pin_resets(status);

alter table sb_pin_resets enable row level security;
drop policy if exists "public_all" on sb_pin_resets;
create policy "public_all" on sb_pin_resets for all using (true) with check (true);
