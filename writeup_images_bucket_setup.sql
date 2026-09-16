-- Fantasy Chatroom -- Storage bucket for images embedded in writeups.
-- Run once in the Supabase SQL editor. Safe to re-run.
--
-- Public read/write, matching this app's existing security model: writeups
-- themselves are gated by a client-side PIN/trivia gate rather than real
-- RLS (see schema.sql's note on the anon-key/PIN approach), so this bucket
-- follows the same "courtesy lock, not real access control" posture.

insert into storage.buckets (id, name, public, file_size_limit)
select 'writeup-images', 'writeup-images', true, 5242880 -- 5MB, matches MAX_IMAGE_BYTES in app/writeups/page.js
where not exists (select 1 from storage.buckets where id = 'writeup-images');

-- Postgres has no "create policy if not exists" -- drop-then-create is the
-- standard idempotent pattern for policies.
drop policy if exists "writeup_images_public_read" on storage.objects;
create policy "writeup_images_public_read" on storage.objects
  for select using (bucket_id = 'writeup-images');

drop policy if exists "writeup_images_public_insert" on storage.objects;
create policy "writeup_images_public_insert" on storage.objects
  for insert with check (bucket_id = 'writeup-images');

drop policy if exists "writeup_images_public_update" on storage.objects;
create policy "writeup_images_public_update" on storage.objects
  for update using (bucket_id = 'writeup-images');

drop policy if exists "writeup_images_public_delete" on storage.objects;
create policy "writeup_images_public_delete" on storage.objects
  for delete using (bucket_id = 'writeup-images');
