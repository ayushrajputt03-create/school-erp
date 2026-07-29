-- ==========================================================
-- RLS ko tez karna. Do cheezein, dono se kiska kya dikhta hai wo NAHI badalta.
--
-- 1) `current_school_id()` policy me seedha likha ho to Postgres use HAR ROW par
--    chalata hai. 544 rows = 544 baar. `(select current_school_id())` likhne se
--    wo InitPlan ban jaata hai — poore query me sirf EK baar.
--
-- 2) Write policies `FOR ALL` thi. ALL me SELECT bhi aata hai, matlab har read
--    par DO policies chalti thi: read wali bhi aur write wali bhi. Write ko
--    INSERT/UPDATE/DELETE me baant diya, to ab read par sirf read wali chalti hai.
--
--    Ye surakshit isliye hai ki `can_see_class()` admin ke liye pehle hi `true`
--    lautata hai — admin ko students ab bhi poore dikhte hain, bas raasta ek hai.
-- ==========================================================

-- ---------- aam pattern: sab padh sakte hain, sirf admin likh sakta hai ----------
do $$
declare t text;
begin
  foreach t in array array[
    'admission_requests','certificate_counters','certificates','date_sheets','exams',
    'homework','leave_requests','notices','parent_notifications','parent_students',
    'parents','report_cards','report_marks','staff','staff_attendance','transport_allocations'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_write', t);
    execute format('drop policy if exists %I on public.%I', t || '_admin_write', t);

    execute format(
      'create policy %I on public.%I for select to authenticated
         using (school_id = (select public.current_school_id()))', t || '_read', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated
         with check (school_id = (select public.current_school_id())
                     and (select public.is_school_admin()))', t || '_ins', t);
    execute format(
      'create policy %I on public.%I for update to authenticated
         using (school_id = (select public.current_school_id())
                and (select public.is_school_admin()))
         with check (school_id = (select public.current_school_id())
                     and (select public.is_school_admin()))', t || '_upd', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated
         using (school_id = (select public.current_school_id())
                and (select public.is_school_admin()))', t || '_del', t);
  end loop;
end $$;

-- ---------- sirf admin, padhna bhi: yahan ek hi policy hai, bas wrap karna hai ----------
do $$
declare t text;
begin
  foreach t in array array[
    'audit_logs','counters','fee_counters','fee_fines','fee_groups',
    'fee_receipts','fee_structures','subscriptions'
  ] loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_all', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (school_id = (select public.current_school_id())
                and (select public.is_school_admin()))
         with check (school_id = (select public.current_school_id())
                     and (select public.is_school_admin()))', t || '_admin_all', t);
  end loop;
end $$;

-- ---------- students: read me class ki paabandi hai ----------
drop policy if exists students_read on public.students;
drop policy if exists students_admin_write on public.students;

create policy students_read on public.students for select to authenticated
  using (school_id = (select public.current_school_id()) and public.can_see_class(class_name));
create policy students_ins on public.students for insert to authenticated
  with check (school_id = (select public.current_school_id()) and (select public.is_school_admin()));
create policy students_upd on public.students for update to authenticated
  using (school_id = (select public.current_school_id()) and (select public.is_school_admin()))
  with check (school_id = (select public.current_school_id()) and (select public.is_school_admin()));
create policy students_del on public.students for delete to authenticated
  using (school_id = (select public.current_school_id()) and (select public.is_school_admin()));

-- ---------- attendance: student ke zariye class ki paabandi ----------
drop policy if exists attendance_read on public.attendance;
drop policy if exists attendance_write on public.attendance;

create policy attendance_read on public.attendance for select to authenticated
  using (school_id = (select public.current_school_id())
         and exists (select 1 from public.students st
                      where st.id = attendance.student_id and public.can_see_class(st.class_name)));
create policy attendance_ins on public.attendance for insert to authenticated
  with check (school_id = (select public.current_school_id())
              and exists (select 1 from public.students st
                           where st.id = attendance.student_id and public.can_see_class(st.class_name)));
create policy attendance_upd on public.attendance for update to authenticated
  using (school_id = (select public.current_school_id())
         and exists (select 1 from public.students st
                      where st.id = attendance.student_id and public.can_see_class(st.class_name)))
  with check (school_id = (select public.current_school_id())
              and exists (select 1 from public.students st
                           where st.id = attendance.student_id and public.can_see_class(st.class_name)));
create policy attendance_del on public.attendance for delete to authenticated
  using (school_id = (select public.current_school_id())
         and exists (select 1 from public.students st
                      where st.id = attendance.student_id and public.can_see_class(st.class_name)));

drop policy if exists attendance_summary_read on public.attendance_summary;
create policy attendance_summary_read on public.attendance_summary for select to authenticated
  using (school_id = (select public.current_school_id())
         and exists (select 1 from public.students st
                      where st.id = attendance_summary.student_id and public.can_see_class(st.class_name)));

-- ---------- kv: paise wale node sirf admin ko ----------
drop policy if exists kv_read on public.kv;
drop policy if exists kv_write on public.kv;

create policy kv_read on public.kv for select to authenticated
  using (school_id = (select public.current_school_id())
         and ((select public.is_school_admin())
              or split_part(path, '/', 1) <> all (array['expenses','accounts','backupSettings','auditLogs','parentSessions'])));
create policy kv_ins on public.kv for insert to authenticated
  with check (school_id = (select public.current_school_id()) and (select public.is_school_admin()));
create policy kv_upd on public.kv for update to authenticated
  using (school_id = (select public.current_school_id()) and (select public.is_school_admin()))
  with check (school_id = (select public.current_school_id()) and (select public.is_school_admin()));
create policy kv_del on public.kv for delete to authenticated
  using (school_id = (select public.current_school_id()) and (select public.is_school_admin()));

-- ---------- app_users ----------
drop policy if exists app_users_self_read on public.app_users;
drop policy if exists app_users_school_read on public.app_users;
drop policy if exists app_users_admin_write on public.app_users;
drop policy if exists app_users_claim_own_school on public.app_users;

-- Ek hi SELECT policy: apni row, ya (admin hone par) apne school ki rows.
-- Pehle ye teen alag policies thi jo har read par teeno chalti thi.
create policy app_users_read on public.app_users for select to authenticated
  using (id = (select auth.uid())
         or (school_id = (select public.current_school_id()) and (select public.is_school_admin())));
create policy app_users_ins on public.app_users for insert to authenticated
  with check (school_id = (select public.current_school_id()) and (select public.is_school_admin()));
-- naya user apni khaali row me apna school bhar sakta hai (register ka raasta)
create policy app_users_upd on public.app_users for update to authenticated
  using ((id = (select auth.uid()) and school_id is null)
         or (school_id = (select public.current_school_id()) and (select public.is_school_admin())))
  with check (id = (select auth.uid())
              or (school_id = (select public.current_school_id()) and (select public.is_school_admin())));
create policy app_users_del on public.app_users for delete to authenticated
  using (school_id = (select public.current_school_id()) and (select public.is_school_admin()));

-- ---------- schools ----------
drop policy if exists schools_read on public.schools;
drop policy if exists schools_admin_write on public.schools;
create policy schools_read on public.schools for select to authenticated
  using (id = (select public.current_school_id()));
create policy schools_admin_write on public.schools for update to authenticated
  using (id = (select public.current_school_id()) and (select public.is_school_admin()))
  with check (id = (select public.current_school_id()) and (select public.is_school_admin()));

-- ---------- jo foreign key bina index ke the ----------
create index if not exists attendance_summary_student_idx on public.attendance_summary (student_id);
create index if not exists fee_fines_student_idx           on public.fee_fines (student_id);
create index if not exists leave_requests_student_idx      on public.leave_requests (student_id);
create index if not exists parent_notifications_student_idx on public.parent_notifications (student_id);
create index if not exists parent_students_school_idx      on public.parent_students (school_id);
create index if not exists school_codes_school_idx         on public.school_codes (school_id);
create index if not exists staff_auth_user_idx             on public.staff (auth_user_id);
create index if not exists staff_attendance_staff_idx      on public.staff_attendance (staff_id);
create index if not exists transport_allocations_student_idx on public.transport_allocations (student_id);

-- RLS ki har read yahin se guzarti hai: app_users(id) -> school_id, role
create index if not exists app_users_id_school_role_idx on public.app_users (id) include (school_id, role);
-- students ka soft-delete filter (activeOnly / deletedOnly) har list read par lagta hai
create index if not exists students_school_deleted_idx on public.students (school_id, deleted_at);;
