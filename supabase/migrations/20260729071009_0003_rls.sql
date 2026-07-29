-- ============================================================
-- RLS. Sab kuch school_id pe bandha hai.
-- service_role (api/parent-portal.js) RLS bypass karta hai — wo alag hai.
-- ============================================================

create or replace function public.is_school_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(public.current_role_name() in ('owner','admin'), false)
$$;

-- teacher sirf apni assigned classes dekhega
create or replace function public.can_see_class(p_class text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.is_school_admin() then true
    when p_class is null then false
    else exists (
      select 1 from public.staff s
      where s.auth_user_id = auth.uid()
        and s.assigned_classes is not null
        and trim(p_class) = any (
          select trim(x) from unnest(string_to_array(s.assigned_classes, ',')) x
        )
    )
  end
$$;

-- ---------- app_users ----------
create policy app_users_self_read on public.app_users
  for select to authenticated using (id = auth.uid());

create policy app_users_school_read on public.app_users
  for select to authenticated using (school_id = public.current_school_id() and public.is_school_admin());

create policy app_users_admin_write on public.app_users
  for all to authenticated
  using (school_id = public.current_school_id() and public.is_school_admin())
  with check (school_id = public.current_school_id() and public.is_school_admin());

-- ---------- schools ----------
create policy schools_read on public.schools
  for select to authenticated using (id = public.current_school_id());

create policy schools_admin_write on public.schools
  for update to authenticated
  using (id = public.current_school_id() and public.is_school_admin())
  with check (id = public.current_school_id() and public.is_school_admin());

-- ---------- school_codes: sabko padhne do (login pe code check hota hai) ----------
create policy school_codes_read on public.school_codes
  for select to authenticated, anon using (true);

-- ---------- students: teacher ko sirf apni class ----------
create policy students_read on public.students
  for select to authenticated
  using (school_id = public.current_school_id() and public.can_see_class(class_name));

create policy students_admin_write on public.students
  for all to authenticated
  using (school_id = public.current_school_id() and public.is_school_admin())
  with check (school_id = public.current_school_id() and public.is_school_admin());

-- ---------- staff ----------
create policy staff_read on public.staff
  for select to authenticated using (school_id = public.current_school_id());

create policy staff_admin_write on public.staff
  for all to authenticated
  using (school_id = public.current_school_id() and public.is_school_admin())
  with check (school_id = public.current_school_id() and public.is_school_admin());

-- ---------- attendance: teacher apni class ki le/dekh sakta hai ----------
create policy attendance_read on public.attendance
  for select to authenticated
  using (
    school_id = public.current_school_id()
    and exists (select 1 from public.students st where st.id = student_id and public.can_see_class(st.class_name))
  );

create policy attendance_write on public.attendance
  for all to authenticated
  using (
    school_id = public.current_school_id()
    and exists (select 1 from public.students st where st.id = student_id and public.can_see_class(st.class_name))
  )
  with check (
    school_id = public.current_school_id()
    and exists (select 1 from public.students st where st.id = student_id and public.can_see_class(st.class_name))
  );

create policy attendance_summary_read on public.attendance_summary
  for select to authenticated
  using (
    school_id = public.current_school_id()
    and exists (select 1 from public.students st where st.id = student_id and public.can_see_class(st.class_name))
  );

-- ---------- parents ----------
create policy parents_read on public.parents
  for select to authenticated using (school_id = public.current_school_id());

create policy parents_admin_write on public.parents
  for all to authenticated
  using (school_id = public.current_school_id() and public.is_school_admin())
  with check (school_id = public.current_school_id() and public.is_school_admin());

create policy parent_students_read on public.parent_students
  for select to authenticated using (school_id = public.current_school_id());

create policy parent_students_admin_write on public.parent_students
  for all to authenticated
  using (school_id = public.current_school_id() and public.is_school_admin())
  with check (school_id = public.current_school_id() and public.is_school_admin());

-- ---------- money: sirf admin ----------
do $$
declare t text;
begin
  foreach t in array array['fee_groups','fee_structures','fee_receipts','fee_fines','fee_counters','subscriptions','audit_logs','counters'] loop
    execute format($p$
      create policy %1$s_admin_all on public.%1$I
        for all to authenticated
        using (school_id = public.current_school_id() and public.is_school_admin())
        with check (school_id = public.current_school_id() and public.is_school_admin())
    $p$, t);
  end loop;
end $$;

-- ---------- baaki modules: school ke andar sabko read, admin ko write ----------
do $$
declare t text;
begin
  foreach t in array array[
    'exams','report_marks','report_cards','date_sheets','certificates','certificate_counters',
    'homework','notices','transport_allocations','leave_requests','admission_requests',
    'staff_attendance','parent_notifications'
  ] loop
    execute format($p$
      create policy %1$s_read on public.%1$I
        for select to authenticated
        using (school_id = public.current_school_id())
    $p$, t);
    execute format($p$
      create policy %1$s_write on public.%1$I
        for all to authenticated
        using (school_id = public.current_school_id() and public.is_school_admin())
        with check (school_id = public.current_school_id() and public.is_school_admin())
    $p$, t);
  end loop;
end $$;
;
