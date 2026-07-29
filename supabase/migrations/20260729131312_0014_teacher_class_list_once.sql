-- Teacher ke liye can_see_class() HAR ROW par chalta tha, aur har baar andar do
-- EXISTS query (app_users + staff). 227 students = 454 chhoti queries.
--
-- Ab teacher ki classes ek hi baar nikalti hain. `in (select unnest(...))` ka
-- roop jaan-boojh kar chuna hai: ye row se juda hua nahi hai, isliye Postgres
-- ise ek baar chala ke hash bana leta hai, har row par nahi.
-- (`= any((select ...))` yahan chalta hi nahi — wo array ko rows ka set samajhta hai.)
--
-- can_see_class() ko hataya nahi ja raha: jahan pehle se lagi hai wahan chalti rahe.
create or replace function public.my_visible_classes()
returns text[]
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    array(
      select distinct trim(x) from (
        select unnest(au.assigned_classes) x
          from public.app_users au
         where au.id = auth.uid() and au.assigned_classes is not null
        union all
        select unnest(string_to_array(s.assigned_classes, ',')) x
          from public.staff s
         where s.auth_user_id = auth.uid() and s.assigned_classes is not null
      ) t
       where trim(x) <> ''
    ),
    array[]::text[]
  )
$$;

revoke all on function public.my_visible_classes() from public;
grant execute on function public.my_visible_classes() to authenticated;

drop policy if exists students_read on public.students;
create policy students_read on public.students for select to authenticated
  using (school_id = (select public.current_school_id())
         and ((select public.is_school_admin())
              or trim(class_name) in (select unnest(public.my_visible_classes()))));

drop policy if exists attendance_read on public.attendance;
create policy attendance_read on public.attendance for select to authenticated
  using (school_id = (select public.current_school_id())
         and ((select public.is_school_admin())
              or exists (select 1 from public.students st
                          where st.id = attendance.student_id
                            and trim(st.class_name) in (select unnest(public.my_visible_classes())))));

drop policy if exists attendance_summary_read on public.attendance_summary;
create policy attendance_summary_read on public.attendance_summary for select to authenticated
  using (school_id = (select public.current_school_id())
         and ((select public.is_school_admin())
              or exists (select 1 from public.students st
                          where st.id = attendance_summary.student_id
                            and trim(st.class_name) in (select unnest(public.my_visible_classes())))));

create index if not exists students_school_class_idx on public.students (school_id, class_name);;
