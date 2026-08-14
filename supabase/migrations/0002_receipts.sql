-- Fuhrpark-Manager: fuel/receipt photo upload via Supabase Storage.

-- ---------------------------------------------------------------------------
-- entries.receipt_path — path of the uploaded receipt within the
-- 'receipts' storage bucket, e.g. "<user_id>/<uuid>.jpg". Null if no
-- receipt was attached.
-- ---------------------------------------------------------------------------
alter table public.entries
  add column if not exists receipt_path text;

-- ---------------------------------------------------------------------------
-- Private storage bucket for receipt photos/PDFs.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- RLS on storage.objects, scoped to the 'receipts' bucket.
-- Uploads are namespaced by folder: "<auth.uid()>/<file>". Mitarbeiter may
-- only read/write inside their own folder; admins may read (and clean up)
-- everything, mirroring the entries table policies.
-- ---------------------------------------------------------------------------
drop policy if exists "receipts_select_own_or_admin" on storage.objects;
create policy "receipts_select_own_or_admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'receipts'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

drop policy if exists "receipts_insert_own" on storage.objects;
create policy "receipts_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_delete_admin_only" on storage.objects;
create policy "receipts_delete_admin_only"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'receipts' and public.is_admin()
  );
