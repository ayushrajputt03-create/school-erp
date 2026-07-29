-- Student delete hone par uski attendance cascade se hatti hai. Purana trigger
-- us waqt bhi summary row banane ki koshish karta tha — us student ke liye jo
-- ab maujood hi nahi. Natija: foreign key error, aur student delete hi nahi hota.
--
-- Ab: attendance khatam ho gayi (ya student hi chala gaya) to summary row
-- mita do, banao mat.

create or replace function public.sync_attendance_summary()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  k_school  uuid;
  k_student uuid;
  k_month   text;
  n_rows    integer;

  procedure_recount record;
begin
  k_school  := coalesce(new.school_id,  old.school_id);
  k_student := coalesce(new.student_id, old.student_id);
  k_month   := to_char(coalesce(new.date, old.date), 'YYYY-MM');

  select
    count(*)                                   as total,
    count(*) filter (where a.status = 'P')     as p,
    count(*) filter (where a.status = 'A')     as a,
    count(*) filter (where a.status = 'L')     as l,
    count(*) filter (where a.status = 'H')     as h,
    count(*) filter (where a.status = 'HD')    as hd
    into procedure_recount
  from public.attendance a
  where a.school_id = k_school
    and a.student_id = k_student
    and to_char(a.date, 'YYYY-MM') = k_month;

  n_rows := procedure_recount.total;

  if n_rows = 0 or not exists (select 1 from public.students s where s.id = k_student) then
    delete from public.attendance_summary
     where school_id = k_school and student_id = k_student and month = k_month;
  else
    insert into public.attendance_summary as s
      (school_id, student_id, month, present, absent, leave_count, holiday, half_day, updated_at)
    values
      (k_school, k_student, k_month,
       procedure_recount.p, procedure_recount.a, procedure_recount.l,
       procedure_recount.h, procedure_recount.hd, now())
    on conflict (school_id, student_id, month) do update
      set present     = excluded.present,
          absent      = excluded.absent,
          leave_count = excluded.leave_count,
          holiday     = excluded.holiday,
          half_day    = excluded.half_day,
          updated_at  = now();
  end if;

  -- date badli ho to purane mahine ka hisaab bhi theek karo
  if tg_op = 'UPDATE' and to_char(old.date, 'YYYY-MM') <> k_month then
    delete from public.attendance_summary s
     where s.school_id = old.school_id
       and s.student_id = old.student_id
       and s.month = to_char(old.date, 'YYYY-MM')
       and not exists (
         select 1 from public.attendance a
          where a.school_id = old.school_id and a.student_id = old.student_id
            and to_char(a.date, 'YYYY-MM') = to_char(old.date, 'YYYY-MM')
       );

    update public.attendance_summary s
       set present     = sub.p, absent = sub.a, leave_count = sub.l,
           holiday     = sub.h, half_day = sub.hd, updated_at = now()
      from (
        select count(*) filter (where status='P')  p,
               count(*) filter (where status='A')  a,
               count(*) filter (where status='L')  l,
               count(*) filter (where status='H')  h,
               count(*) filter (where status='HD') hd
        from public.attendance
        where school_id = old.school_id and student_id = old.student_id
          and to_char(date,'YYYY-MM') = to_char(old.date,'YYYY-MM')
      ) sub
     where s.school_id = old.school_id and s.student_id = old.student_id
       and s.month = to_char(old.date,'YYYY-MM');
  end if;

  return null;
end $$;;
