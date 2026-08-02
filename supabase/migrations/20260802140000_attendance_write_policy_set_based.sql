-- Attendance ki write policies har row par can_see_class() bula rahi thi.
--
-- can_see_class(st.class_name) ka argument har row se aata hai, isliye Postgres
-- use InitPlan me nahi badal sakta — ek class ki attendance save karte waqt
-- 40 row = 40 function call, aur har call ke andar app_users + staff par do
-- alag sub-select. Read policy (attendance_read) pehle se hi set-wala tareeka
-- use karti hai: trim(class_name) in (select unnest(my_visible_classes())).
-- my_visible_classes() ka koi argument nahi hai, to wo poore statement me
-- sirf ek baar chalta hai.
--
-- Yahan write policies ko usi shakal me laa rahe hain. Do fayde:
--   1. bulk attendance save par N function call ki jagah 1
--   2. read aur write ek hi niyam se chalte hain — pehle read set-based tha
--      aur write per-row, jo aage jaake chupchaap alag-alag natije de sakta tha
--
-- Adhikaar wahi rehte hain. can_see_class = admin OR (class teacher ki list me
-- hai), aur policy me is_school_admin() pehle se hi OR ke baayen taraf hai, to
-- admin wala hissa waise hi kaam karta hai. Ek chhota farak hai: agar teacher
-- ki assigned list me khaali string ho aur student ka class_name bhi khaali ho,
-- to purana can_see_class use match maan leta tha. my_visible_classes()
-- khaali entries hata deta hai, to ab nahi manega. Ye theek hai — read policy
-- aaj bhi aisi row nahi dikhati, yaani teacher us row ko padh nahi sakta tha
-- par likh sakta tha.

drop policy if exists attendance_ins on public.attendance;
create policy attendance_ins on public.attendance
  for insert to authenticated
  with check (
    school_id = (select public.current_school_id())
    and (
      (select public.is_school_admin())
      or exists (
        select 1 from public.students st
         where st.id = attendance.student_id
           and trim(st.class_name) in (select unnest(public.my_visible_classes()))
      )
    )
  );

drop policy if exists attendance_upd on public.attendance;
create policy attendance_upd on public.attendance
  for update to authenticated
  using (
    school_id = (select public.current_school_id())
    and (
      (select public.is_school_admin())
      or exists (
        select 1 from public.students st
         where st.id = attendance.student_id
           and trim(st.class_name) in (select unnest(public.my_visible_classes()))
      )
    )
  )
  with check (
    school_id = (select public.current_school_id())
    and (
      (select public.is_school_admin())
      or exists (
        select 1 from public.students st
         where st.id = attendance.student_id
           and trim(st.class_name) in (select unnest(public.my_visible_classes()))
      )
    )
  );

drop policy if exists attendance_del on public.attendance;
create policy attendance_del on public.attendance
  for delete to authenticated
  using (
    school_id = (select public.current_school_id())
    and (
      (select public.is_school_admin())
      or exists (
        select 1 from public.students st
         where st.id = attendance.student_id
           and trim(st.class_name) in (select unnest(public.my_visible_classes()))
      )
    )
  );
