-- Fix the staff/receptionist auth bootstrap INSERT after the original RBAC migration.
-- Only required auth.users columns are listed; optional token columns use Supabase defaults.

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
  if not found then
    raise exception 'ensure_staff_auth_user: % is school ka staff nahi hai', p_staff_legacy;
  end if;

  v_role := case v_staff_role
    when 'admin' then 'admin'
    when 'teacher' then 'teacher'
    when 'class teacher' then 'teacher'
    when 'receptionist' then 'receptionist'
    when 'accountant' then 'accountant'
    else 'staff'
  end;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated',
    v_email, '$2a$10$staffhasnopasswordstaffhasnopasswordstaffhasnopassworda', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', coalesce(p_name,''), 'staff_id', p_staff_legacy), now(), now()
  ) on conflict (id) do nothing;

  insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (v_id::text, v_id, jsonb_build_object('sub',v_id::text,'email',v_email,'email_verified',true,'phone_verified',false),'email',now(),now())
  on conflict (provider, provider_id) do nothing;

  insert into public.app_users (id, legacy_uid, school_id, role, email, full_name)
  values (v_id, p_staff_legacy, p_school, v_role, v_email, nullif(coalesce(p_name,''),''))
  on conflict (id) do update set
    legacy_uid = excluded.legacy_uid,
    school_id = excluded.school_id,
    role = excluded.role,
    email = coalesce(public.app_users.email, excluded.email),
    full_name = coalesce(public.app_users.full_name, excluded.full_name);

  if v_role = 'receptionist' then
    insert into public.notification_templates (school_id, code, title, body) values
      (p_school, 'FEE_VISIT', 'Fee desk visit', 'Please visit the school fee desk for assistance.'),
      (p_school, 'DOCUMENT_REMINDER', 'Document reminder', 'Please submit the pending student documents to the school office.'),
      (p_school, 'SCHOOL_VISIT', 'School office reminder', 'Please contact the school office during working hours.')
    on conflict (school_id, code) do nothing;
  end if;

  update public.staff set auth_user_id = v_id
    where school_id = p_school and legacy_id = p_staff_legacy and auth_user_id is distinct from v_id;

  return query select v_id, (select u.email::text from auth.users u where u.id = v_id);
end $fn$;

revoke all on function public.ensure_staff_auth_user(uuid,text,text,text,text) from public, anon, authenticated;
grant execute on function public.ensure_staff_auth_user(uuid,text,text,text,text) to service_role;
