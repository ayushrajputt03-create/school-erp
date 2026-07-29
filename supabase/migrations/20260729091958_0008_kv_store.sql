-- ============================================================
-- kv — jin nodes ki apni table nahi hai unke liye.
--
-- timetable, library, expenses, accounts, enquiries, idCards,
-- employeeManager, studentDocuments, certificateSettings, approvals...
-- Ye kam use hote hain, inka dhaancha badalta rehta hai, aur in par
-- koi SQL report nahi chalani. RTDB jaisa hi vyavhaar chahiye.
--
-- Ek row = school ka ek top-level node, poora subtree jsonb me.
-- Adapter andar ke path (library/settings) ko jsonb ke andar dhoondh leta hai.
-- ============================================================

create table public.kv (
  school_id  uuid not null references public.schools(id) on delete cascade,
  path       text not null,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (school_id, path)
);

create index kv_school_idx on public.kv (school_id);

create trigger kv_updated_at before update on public.kv
  for each row execute function public.set_updated_at();

alter table public.kv enable row level security;

-- Paise wale nodes (expenses, accounts) sirf admin ko.
-- Baaki school ke andar sabko padhne do, likhna admin hi kare.
create policy kv_read on public.kv
  for select to authenticated
  using (
    school_id = public.current_school_id()
    and (
      public.is_school_admin()
      or split_part(path, '/', 1) not in ('expenses', 'accounts', 'backupSettings', 'auditLogs', 'parentSessions')
    )
  );

create policy kv_write on public.kv
  for all to authenticated
  using (school_id = public.current_school_id() and public.is_school_admin())
  with check (school_id = public.current_school_id() and public.is_school_admin());;
