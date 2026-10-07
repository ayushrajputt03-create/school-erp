-- Server-only atomic throttles, shared across serverless instances.
create table if not exists public.security_rate_limits (
  key text primary key, count integer not null, expires_at timestamptz not null
);
alter table public.security_rate_limits enable row level security;
revoke all on public.security_rate_limits from anon, authenticated;
create or replace function public.consume_security_rate_limit(p_key text, p_limit integer, p_window integer)
returns boolean language plpgsql set search_path = public as $$
declare v_count integer;
begin
  if p_limit < 1 or p_window < 1 then raise exception 'Invalid rate limit'; end if;
  insert into public.security_rate_limits(key,count,expires_at)
    values (p_key,1,now() + make_interval(secs => p_window))
  on conflict(key) do update set
    count = case when security_rate_limits.expires_at <= now() then 1 else security_rate_limits.count + 1 end,
    expires_at = case when security_rate_limits.expires_at <= now() then excluded.expires_at else security_rate_limits.expires_at end
  returning count into v_count;
  delete from public.security_rate_limits where expires_at < now() - interval '1 day';
  return v_count <= p_limit;
end $$;
revoke all on function public.consume_security_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consume_security_rate_limit(text,integer,integer) to service_role;

drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff for select to authenticated using (
  school_id = (select public.current_school_id())
  and ((select public.is_school_admin()) or auth_user_id = (select auth.uid()))
);
do $$ declare t text; begin
  foreach t in array array['parents','parent_students','parent_notifications','admission_requests','staff_attendance','transport_allocations','certificate_counters'] loop
    execute format('drop policy if exists %I on public.%I',t || '_read',t);
    execute format('create policy %I on public.%I for select to authenticated using (school_id = (select public.current_school_id()) and (select public.is_school_admin()))',t || '_read',t);
  end loop;
  foreach t in array array['report_marks','report_cards','certificates','homework','date_sheets'] loop
    execute format('drop policy if exists %I on public.%I',t || '_read',t);
    execute format('create policy %I on public.%I for select to authenticated using (school_id = (select public.current_school_id()) and ((select public.is_school_admin()) or ((select public.current_role_name()) = ''teacher'' and public.can_see_class(class_name))))',t || '_read',t);
  end loop;
end $$;
drop policy if exists kv_read on public.kv;
create policy kv_read on public.kv for select to authenticated using (
  school_id = (select public.current_school_id())
  and split_part(path,'/',1) not in ('staffCredentials','parentSessions','parentLoginAttempts')
  and ((select public.is_school_admin()) or (
    (select public.current_role_name()) = 'teacher'
    and split_part(path,'/',1) in ('timetable','timetableRecords','periodSettings','subjects')
  ))
);
drop policy if exists kv_write on public.kv;
create policy kv_write on public.kv for all to authenticated using (
  school_id = (select public.current_school_id()) and (select public.is_school_admin())
  and split_part(path,'/',1) not in ('staffCredentials','parentSessions','parentLoginAttempts')
) with check (
  school_id = (select public.current_school_id()) and (select public.is_school_admin())
  and split_part(path,'/',1) not in ('staffCredentials','parentSessions','parentLoginAttempts')
);
update storage.buckets set allowed_mime_types = array['image/png','image/jpeg','image/webp'] where id = 'school-assets';
update storage.buckets set file_size_limit = 2097152 where id = 'student-photos';
