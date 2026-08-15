-- Fuhrpark-Manager: TÜV reminder tracking table.
--
-- The `tuv-reminder` Edge Function (supabase/functions/tuv-reminder) checks
-- daily for vehicles whose TÜV is due within the next 30 days and emails all
-- admins. This table records which (vehicle_id, tuv_date) pairs have already
-- been notified so a reminder is sent exactly once per due date, even if the
-- daily cron run is occasionally delayed or missed.

create table if not exists public.tuv_reminders (
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  tuv_date   date not null,
  sent_at    timestamptz not null default now(),
  primary key (vehicle_id, tuv_date)
);

alter table public.tuv_reminders enable row level security;

-- Written by the Edge Function via the service role key (bypasses RLS).
-- Admins may read the log for visibility; no insert/update/delete policy is
-- needed for regular authenticated users.
drop policy if exists "tuv_reminders_select_admin_only" on public.tuv_reminders;
create policy "tuv_reminders_select_admin_only"
  on public.tuv_reminders for select
  to authenticated
  using (public.is_admin());

create index if not exists vehicles_tuv_date_idx on public.vehicles (tuv_date);
