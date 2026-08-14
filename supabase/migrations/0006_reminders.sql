-- Fuhrpark-Manager: Erinnerungen für alle Fristen-Module (nicht mehr nur TÜV).
--
-- Die alte Tabelle tuv_reminders wird durch reminder_log ersetzt, das
-- zusätzlich das Modul (hu, au, uvv, …) und Führerschein-Erinnerungen abdeckt.

create table if not exists public.reminder_log (
  subject_type text not null check (subject_type in ('vehicle', 'profile')),
  subject_id   uuid not null,
  module_key   text not null,
  due_date     date not null,
  sent_at      timestamptz not null default now(),
  primary key (subject_type, subject_id, module_key, due_date)
);

alter table public.reminder_log enable row level security;

-- Geschrieben wird ausschließlich von der Edge Function per Service-Role-Key
-- (umgeht RLS). Admins dürfen den Verlauf ihrer Firma einsehen.
drop policy if exists "reminder_log_select_admin" on public.reminder_log;
create policy "reminder_log_select_admin"
  on public.reminder_log for select
  to authenticated
  using (
    public.is_admin()
    and (
      (subject_type = 'vehicle' and exists (
        select 1 from public.vehicles v
         where v.id = reminder_log.subject_id
           and v.company_id = public.current_company_id()
      ))
      or (subject_type = 'profile' and exists (
        select 1 from public.profiles p
         where p.id = reminder_log.subject_id
           and p.company_id = public.current_company_id()
      ))
    )
  );

-- Bestehende TÜV-Erinnerungen übernehmen, damit nach dem Update keine
-- Dubletten für bereits gemeldete Termine verschickt werden.
insert into public.reminder_log (subject_type, subject_id, module_key, due_date, sent_at)
select 'vehicle', vehicle_id, 'hu', tuv_date, sent_at
  from public.tuv_reminders
on conflict do nothing;

drop table if exists public.tuv_reminders;

create index if not exists profiles_license_expiry_idx
  on public.profiles (license_expires_on)
  where license_expires_on is not null;
