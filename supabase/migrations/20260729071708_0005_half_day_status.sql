alter table public.attendance drop constraint attendance_status_chk;
alter table public.attendance add constraint attendance_status_chk
  check (status in ('P','A','L','H','HD'));

alter table public.staff_attendance add constraint staff_attendance_status_chk
  check (status in ('P','A','L','H','HD'));

alter table public.attendance_summary add column half_day integer not null default 0;
;
