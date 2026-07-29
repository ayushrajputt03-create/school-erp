create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function public.ms_to_ts(ms bigint)
returns timestamptz language sql immutable as $$
  select case when ms is null or ms = 0 then null
              else to_timestamp(ms / 1000.0) end
$$;

create table public.schools (
  id                        uuid primary key default gen_random_uuid(),
  legacy_id                 text unique not null,
  name                      text not null,
  code                      text unique,
  academic_year             text,
  address                   text,
  city                      text,
  district                  text,
  state                     text,
  pincode                   text,
  phone                     text,
  email                     text,
  board                     text,
  affiliated_to             text,
  affiliation_no            text,
  custom_affiliation        text,
  udise_no                  text,
  classes_offered           text,
  school_motto              text,
  school_website            text,
  principal_name            text,
  logo_url                  text,
  logo_path                 text,
  seal_url                  text,
  principal_signature_url   text,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  last_login_at             timestamptz,
  source                    jsonb
);

create trigger schools_updated_at before update on public.schools
  for each row execute function public.set_updated_at();

create table public.app_users (
  id            uuid primary key,
  legacy_uid    text unique,
  school_id     uuid references public.schools(id) on delete cascade,
  role          text not null default 'teacher',
  full_name     text,
  email         text,
  photo_url     text,
  last_login_at timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  source        jsonb
);

create index app_users_school_idx on public.app_users (school_id);

create trigger app_users_updated_at before update on public.app_users
  for each row execute function public.set_updated_at();

create or replace function public.current_school_id()
returns uuid language sql stable security definer set search_path = public as $$
  select school_id from public.app_users where id = auth.uid()
$$;

create or replace function public.current_role_name()
returns text language sql stable security definer set search_path = public as $$
  select role from public.app_users where id = auth.uid()
$$;

create table public.students (
  id                      uuid primary key default gen_random_uuid(),
  school_id               uuid not null references public.schools(id) on delete cascade,
  legacy_id               text not null,
  full_name               text not null,
  admission_number        text,
  roll_number             text,
  class_name              text,
  section                 text,
  academic_session        text,
  date_of_birth           date,
  gender                  text,
  blood_group             text,
  photo_url               text,
  photo_path              text,
  admission_date          date,
  admission_type          text,
  admission_scheme        text,
  father_name             text,
  father_phone            text,
  father_email            text,
  father_occupation       text,
  father_qualification    text,
  father_aadhaar          text,
  mother_name             text,
  mother_phone            text,
  mother_email            text,
  mother_occupation       text,
  mother_qualification    text,
  mother_aadhaar          text,
  guardian_name           text,
  guardian_phone          text,
  guardian_relation       text,
  address                 text,
  permanent_address       text,
  city                    text,
  district                text,
  state                   text,
  pincode                 text,
  email                   text,
  phone                   text,
  aadhaar                 text,
  apaar_id                text,
  pen_id                  text,
  religion                text,
  caste                   text,
  sub_caste               text,
  category                text,
  category_cert_no        text,
  category_cert_url       text,
  nationality             text,
  mother_tongue           text,
  annual_income           text,
  is_disabled             boolean not null default false,
  disability_percentage   text,
  disability_remarks      text,
  disability_cert_no      text,
  disability_cert_url     text,
  udid_no                 text,
  scribe_required         boolean not null default false,
  extra_exam_time         boolean not null default false,
  special_equipment       text,
  height                  text,
  weight                  text,
  previous_school         text,
  previous_class          text,
  previous_tc_no          text,
  previous_tc_date        date,
  previous_tc_url         text,
  reason_for_leaving      text,
  siblings                integer,
  sibling_in_same_school  boolean not null default false,
  sibling_adm_no          text,
  transport_required      boolean not null default false,
  route_id                text,
  route_name              text,
  stop_name               text,
  pickup_time             text,
  drop_time               text,
  fee_group               text,
  fee_status              text,
  parent_login_phone      text,
  parent_password_dob     boolean not null default true,
  sms_enabled             boolean not null default false,
  active                  boolean not null default true,
  deleted_at              timestamptz,
  deleted_reason          text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),
  source                  jsonb,
  unique (school_id, legacy_id)
);

create index students_school_active_idx on public.students (school_id) where deleted_at is null;
create index students_class_idx         on public.students (school_id, class_name, section) where deleted_at is null;
create index students_admission_idx     on public.students (school_id, admission_number);
create index students_parent_phone_idx  on public.students (school_id, parent_login_phone);

create trigger students_updated_at before update on public.students
  for each row execute function public.set_updated_at();

create table public.staff (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  legacy_id          text not null,
  auth_user_id       uuid references public.app_users(id) on delete set null,
  employee_code      text,
  first_name         text,
  last_name          text,
  full_name          text generated always as (
                       trim(coalesce(first_name,'') || ' ' || coalesce(last_name,''))
                     ) stored,
  father_name        text,
  mother_name        text,
  dob                date,
  gender             text,
  phone              text,
  email              text,
  address            text,
  aadhaar            text,
  department         text,
  department_id      text,
  designation        text,
  designation_id     text,
  employee_role      text,
  employee_status    text,
  subject            text,
  assigned_classes   text,
  assigned_sections  text,
  joining_date       date,
  salary             numeric(12,2),
  photo_url          text,
  photo_path         text,
  active             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  source             jsonb,
  unique (school_id, legacy_id)
);

create index staff_school_idx on public.staff (school_id) where active;

create trigger staff_updated_at before update on public.staff
  for each row execute function public.set_updated_at();

create table public.attendance (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  student_id   uuid not null references public.students(id) on delete cascade,
  date         date not null,
  status       text not null,
  marked_by    text,
  origin       text not null default 'flat',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  source       jsonb,
  constraint attendance_status_chk check (status in ('P','A','L','H')),
  unique (school_id, student_id, date)
);

create index attendance_school_date_idx on public.attendance (school_id, date);
create index attendance_student_idx     on public.attendance (student_id, date desc);

create trigger attendance_updated_at before update on public.attendance
  for each row execute function public.set_updated_at();

create table public.attendance_summary (
  school_id   uuid not null references public.schools(id) on delete cascade,
  student_id  uuid not null references public.students(id) on delete cascade,
  month       text not null,
  present     integer not null default 0,
  absent      integer not null default 0,
  leave_count integer not null default 0,
  holiday     integer not null default 0,
  total       integer generated always as (present + absent + leave_count) stored,
  updated_at  timestamptz not null default now(),
  primary key (school_id, student_id, month)
);

create index attendance_summary_school_month_idx on public.attendance_summary (school_id, month);

create or replace function public.sync_attendance_summary()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  k_school uuid;
  k_student uuid;
  k_month text;
begin
  k_school  := coalesce(new.school_id,  old.school_id);
  k_student := coalesce(new.student_id, old.student_id);
  k_month   := to_char(coalesce(new.date, old.date), 'YYYY-MM');

  insert into public.attendance_summary as s (school_id, student_id, month, present, absent, leave_count, holiday, updated_at)
  select k_school, k_student, k_month,
         count(*) filter (where a.status = 'P'),
         count(*) filter (where a.status = 'A'),
         count(*) filter (where a.status = 'L'),
         count(*) filter (where a.status = 'H'),
         now()
  from public.attendance a
  where a.school_id = k_school
    and a.student_id = k_student
    and to_char(a.date, 'YYYY-MM') = k_month
  on conflict (school_id, student_id, month) do update
    set present     = excluded.present,
        absent      = excluded.absent,
        leave_count = excluded.leave_count,
        holiday     = excluded.holiday,
        updated_at  = now();

  if tg_op = 'UPDATE' and to_char(old.date, 'YYYY-MM') <> k_month then
    update public.attendance_summary s
       set present = sub.p, absent = sub.a, leave_count = sub.l, holiday = sub.h, updated_at = now()
      from (
        select count(*) filter (where status='P') p,
               count(*) filter (where status='A') a,
               count(*) filter (where status='L') l,
               count(*) filter (where status='H') h
        from public.attendance
        where school_id = old.school_id and student_id = old.student_id
          and to_char(date,'YYYY-MM') = to_char(old.date,'YYYY-MM')
      ) sub
     where s.school_id = old.school_id and s.student_id = old.student_id
       and s.month = to_char(old.date,'YYYY-MM');
  end if;

  return null;
end $$;

create trigger attendance_rollup
  after insert or update or delete on public.attendance
  for each row execute function public.sync_attendance_summary();

create table public.parents (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools(id) on delete cascade,
  legacy_id             text not null,
  auth_user_id          uuid,
  name                  text,
  phone                 text not null,
  email                 text,
  address               text,
  language              text default 'english',
  school_code           text,
  default_dob           text,
  must_change_password  boolean not null default true,
  password_set_at       timestamptz,
  last_login            timestamptz,
  fcm_token             text,
  status                text not null default 'active',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  source                jsonb,
  unique (school_id, legacy_id)
);

create index parents_phone_idx on public.parents (school_id, phone);

create trigger parents_updated_at before update on public.parents
  for each row execute function public.set_updated_at();

create table public.parent_students (
  parent_id  uuid not null references public.parents(id)  on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  school_id  uuid not null references public.schools(id)  on delete cascade,
  created_at timestamptz not null default now(),
  primary key (parent_id, student_id)
);

create index parent_students_student_idx on public.parent_students (student_id);

create table public.school_codes (
  code        text primary key,
  school_id   uuid references public.schools(id) on delete cascade,
  school_name text,
  created_at  timestamptz not null default now()
);

alter table public.schools            enable row level security;
alter table public.app_users          enable row level security;
alter table public.students           enable row level security;
alter table public.staff              enable row level security;
alter table public.attendance         enable row level security;
alter table public.attendance_summary enable row level security;
alter table public.parents            enable row level security;
alter table public.parent_students    enable row level security;
alter table public.school_codes       enable row level security;
;
