-- attendance ki har row students me jaake can_see_class() poochti thi. Admin ke
-- liye uska jawab hamesha `true` hai (can_see_class sabse pehle is_school_admin
-- dekhta hai), yaani 662 join sirf "haan" sunne ke liye.
--
-- Admin ko pehle hi nikaal dete hain. Teacher ke liye raasta bilkul wahi hai —
-- kisko kya dikhta hai, usme koi farak nahi.
drop policy if exists attendance_read on public.attendance;
drop policy if exists attendance_ins  on public.attendance;
drop policy if exists attendance_upd  on public.attendance;
drop policy if exists attendance_del  on public.attendance;

create policy attendance_read on public.attendance for select to authenticated
  using (school_id = (select public.current_school_id())
         and ((select public.is_school_admin())
              or exists (select 1 from public.students st
                          where st.id = attendance.student_id
                            and public.can_see_class(st.class_name))));

create policy attendance_ins on public.attendance for insert to authenticated
  with check (school_id = (select public.current_school_id())
              and ((select public.is_school_admin())
                   or exists (select 1 from public.students st
                               where st.id = attendance.student_id
                                 and public.can_see_class(st.class_name))));

create policy attendance_upd on public.attendance for update to authenticated
  using (school_id = (select public.current_school_id())
         and ((select public.is_school_admin())
              or exists (select 1 from public.students st
                          where st.id = attendance.student_id
                            and public.can_see_class(st.class_name))))
  with check (school_id = (select public.current_school_id())
              and ((select public.is_school_admin())
                   or exists (select 1 from public.students st
                               where st.id = attendance.student_id
                                 and public.can_see_class(st.class_name))));

create policy attendance_del on public.attendance for delete to authenticated
  using (school_id = (select public.current_school_id())
         and ((select public.is_school_admin())
              or exists (select 1 from public.students st
                          where st.id = attendance.student_id
                            and public.can_see_class(st.class_name))));

drop policy if exists attendance_summary_read on public.attendance_summary;
create policy attendance_summary_read on public.attendance_summary for select to authenticated
  using (school_id = (select public.current_school_id())
         and ((select public.is_school_admin())
              or exists (select 1 from public.students st
                          where st.id = attendance_summary.student_id
                            and public.can_see_class(st.class_name))));

-- students ka read bhi wahi kahani
drop policy if exists students_read on public.students;
create policy students_read on public.students for select to authenticated
  using (school_id = (select public.current_school_id())
         and ((select public.is_school_admin()) or public.can_see_class(class_name)));

-- attendance ki har list read school+date par chalti hai
create index if not exists attendance_school_date_idx on public.attendance (school_id, date);;
