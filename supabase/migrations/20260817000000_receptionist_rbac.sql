-- Receptionist RBAC: search students, view fees, send only approved notifications.
-- Role source is public.app_users.role; auth.users metadata is never trusted for permissions.

create or replace function public.is_receptionist()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() = 'receptionist', false)
$$;

-- Search is intentionally indexed for the receptionist lookup screen. Trigram indexes keep
-- name/parent partial searches responsive even once a school has many students.
create extension if not exists pg_trgm;
create index if not exists students_full_name_trgm_idx on public.students using gin (lower(full_name) gin_trgm_ops);
create index if not exists students_father_name_trgm_idx on public.students using gin (lower(father_name) gin_trgm_ops);
create index if not exists students_mother_name_trgm_idx on public.students using gin (lower(mother_name) gin_trgm_ops);
create index if not exists students_guardian_name_trgm_idx on public.students using gin (lower(guardian_name) gin_trgm_ops);
create index if not exists students_parent_phone_lookup_idx on public.students (school_id, father_phone, mother_phone, guardian_phone);
create index if not exists fee_receipts_student_date_idx on public.fee_receipts (school_id, student_id, receipt_date desc);

-- A receptionist is allowed full student and fee rows for their own school, but no mutation.
create policy students_receptionist_read on public.students
  for select to authenticated
  using (school_id = (select public.current_school_id()) and (select public.is_receptionist()));

create policy fee_receipts_receptionist_read on public.fee_receipts
  for select to authenticated
  using (school_id = (select public.current_school_id()) and (select public.is_receptionist()));

-- Existing generic module policies are permissive OR policies. Exclude receptionist explicitly,
-- otherwise a new receptionist account would inherit their broad select access.
do $$
declare t text;
begin
  foreach t in array array[
    'admission_requests','certificate_counters','certificates','date_sheets','exams',
    'homework','leave_requests','notices','parent_notifications','parent_students','parents',
    'report_cards','report_marks','staff','staff_attendance','transport_allocations'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format(
      'create policy %I on public.%I for select to authenticated
       using (school_id = (select public.current_school_id()) and not (select public.is_receptionist()))',
      t || '_read', t);
  end loop;
end $$;

drop policy if exists kv_read on public.kv;
create policy kv_read on public.kv for select to authenticated
  using (
    school_id = (select public.current_school_id())
    and not (select public.is_receptionist())
    and ((select public.is_school_admin())
      or split_part(path, '/', 1) <> all (array['expenses','accounts','backupSettings','auditLogs','parentSessions']))
  );

create table if not exists public.notification_templates (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  code text not null,
  title text not null,
  body text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, code)
);
alter table public.notification_templates enable row level security;
create policy notification_templates_admin_all on public.notification_templates for all to authenticated
  using (school_id = (select public.current_school_id()) and (select public.is_school_admin()))
  with check (school_id = (select public.current_school_id()) and (select public.is_school_admin()));
create policy notification_templates_receptionist_read on public.notification_templates for select to authenticated
  using (school_id = (select public.current_school_id()) and active and (select public.is_receptionist()));

-- Keep the security-relevant fields queryable without relying on JSON parsing.
alter table public.audit_logs add column if not exists user_id uuid;
alter table public.audit_logs add column if not exists role text;
alter table public.audit_logs add column if not exists target_student_id uuid;

-- A SECURITY DEFINER function makes free-text broadcasts impossible for receptionist sessions.
-- It resolves the parent relationship server-side, inserts the approved template verbatim and
-- writes an immutable audit entry in the same transaction.
create or replace function public.send_receptionist_notification(p_student_id uuid, p_template_code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_school uuid := public.current_school_id();
  v_parent uuid;
  v_template public.notification_templates%rowtype;
  v_notification uuid := gen_random_uuid();
  v_actor text := auth.uid()::text;
begin
  if not public.is_receptionist() then
    raise exception 'Receptionist permission required';
  end if;

  if not exists (select 1 from public.students where id = p_student_id and school_id = v_school) then
    raise exception 'Student not found in your school';
  end if;

  select * into v_template from public.notification_templates
    where school_id = v_school and code = p_template_code and active;
  if not found then
    raise exception 'Approved notification template not found';
  end if;

  select parent_id into v_parent from public.parent_students
    where school_id = v_school and student_id = p_student_id
    order by created_at asc limit 1;
  if v_parent is null then
    raise exception 'No parent account is linked to this student';
  end if;

  insert into public.parent_notifications (school_id, legacy_id, parent_id, student_id, type, title, body, source)
  values (v_school, 'receptionist_' || replace(v_notification::text, '-', ''), v_parent, p_student_id,
    'receptionist_template', v_template.title, v_template.body,
    jsonb_build_object('templateCode', v_template.code, 'sentBy', auth.uid()::text));

  insert into public.audit_logs (school_id, legacy_id, actor, action, target, detail, source, user_id, role, target_student_id)
  values (v_school, 'audit_' || replace(gen_random_uuid()::text, '-', ''), v_actor,
    'receptionist_notification_sent', p_student_id::text,
    jsonb_build_object('role', 'receptionist', 'templateCode', v_template.code),
    jsonb_build_object('user_id', v_actor, 'role', 'receptionist', 'action', 'notification_sent', 'target_student_id', p_student_id::text),
    auth.uid(), 'receptionist', p_student_id);

  return v_notification;
end $$;

create or replace function public.log_receptionist_fee_view(p_student_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_school uuid := public.current_school_id();
begin
  if not public.is_receptionist() then raise exception 'Receptionist permission required'; end if;
  if not exists (select 1 from public.students where id = p_student_id and school_id = v_school) then
    raise exception 'Student not found in your school';
  end if;
  insert into public.audit_logs (school_id, legacy_id, actor, action, target, detail, source, user_id, role, target_student_id)
  values (v_school, 'audit_' || replace(gen_random_uuid()::text, '-', ''), auth.uid()::text,
    'receptionist_fee_viewed', p_student_id::text,
    jsonb_build_object('role', 'receptionist'),
    jsonb_build_object('user_id', auth.uid()::text, 'role', 'receptionist', 'action', 'fee_viewed', 'target_student_id', p_student_id::text),
    auth.uid(), 'receptionist', p_student_id);
end $$;

revoke all on function public.send_receptionist_notification(uuid, text) from public, anon;
revoke all on function public.log_receptionist_fee_view(uuid) from public, anon;
grant execute on function public.send_receptionist_notification(uuid, text) to authenticated;
grant execute on function public.log_receptionist_fee_view(uuid) to authenticated;

-- Keep role assignment tied to the saved staff employeeRole, not untrusted request input.
create or replace function public.ensure_staff_auth_user(
  p_school uuid, p_staff_legacy text, p_email text, p_role text, p_name text
)
returns table (user_id uuid, user_email text)
language plpgsql security definer set search_path = public as $fn$
declare
  v_id uuid := md5('user|' || p_staff_legacy)::uuid;
  v_email text := lower(trim(p_email));
  v_staff_role text;
  v_role text;
begin
  if p_school is null or coalesce(p_staff_legacy, '') = '' or v_email = '' then
    raise exception 'ensure_staff_auth_user: school, staff id aur email teeno chahiye';
  end if;
  select lower(coalesce(s.employee_role, 'staff')) into v_staff_role
    from public.staff s where s.school_id = p_school and s.legacy_id = p_staff_legacy;
  if not found then raise exception 'ensure_staff_auth_user: % is school ka staff nahi hai', p_staff_legacy; end if;
  v_role := case v_staff_role
    when 'admin' then 'admin'
    when 'teacher' then 'teacher'
    when 'class teacher' then 'teacher'
    when 'receptionist' then 'receptionist'
    when 'accountant' then 'accountant'
    else 'staff'
  end;
  insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
  values ('00000000-0000-0000-0000-000000000000',v_id,'authenticated','authenticated',v_email,'$2a$10$staffhasnopasswordstaffhasnopasswordstaffhasnopassworda',now(),'{"provider":"email","providers":["email"]}'::jsonb,jsonb_build_object('full_name',coalesce(p_name,''),'staff_id',p_staff_legacy),now(),now())
  on conflict (id) do nothing;
  insert into auth.identities (provider_id,user_id,identity_data,provider,created_at,updated_at)
  values (v_id::text,v_id,jsonb_build_object('sub',v_id::text,'email',v_email,'email_verified',true,'phone_verified',false),'email',now(),now())
  on conflict (provider,provider_id) do nothing;
  insert into public.app_users (id,legacy_uid,school_id,role,email,full_name)
  values (v_id,p_staff_legacy,p_school,v_role,v_email,nullif(coalesce(p_name,''),''))
  on conflict (id) do update set legacy_uid=excluded.legacy_uid, school_id=excluded.school_id, role=excluded.role,
    email=coalesce(public.app_users.email,excluded.email), full_name=coalesce(public.app_users.full_name,excluded.full_name);
  if v_role = 'receptionist' then
    insert into public.notification_templates (school_id, code, title, body) values
      (p_school, 'FEE_VISIT', 'Fee desk visit', 'Please visit the school fee desk for assistance.'),
      (p_school, 'DOCUMENT_REMINDER', 'Document reminder', 'Please submit the pending student documents to the school office.'),
      (p_school, 'SCHOOL_VISIT', 'School office reminder', 'Please contact the school office during working hours.')
    on conflict (school_id, code) do nothing;
  end if;
  update public.staff set auth_user_id=v_id where school_id=p_school and legacy_id=p_staff_legacy and auth_user_id is distinct from v_id;
  return query select v_id, (select u.email::text from auth.users u where u.id=v_id);
end $fn$;
revoke all on function public.ensure_staff_auth_user(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.ensure_staff_auth_user(uuid,text,text,text,text) to service_role;
