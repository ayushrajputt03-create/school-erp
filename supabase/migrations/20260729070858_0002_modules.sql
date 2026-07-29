-- ============ FEES ============

create table public.fee_groups (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  legacy_id  text not null,
  name       text not null,
  sort_order integer default 0,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source     jsonb,
  unique (school_id, legacy_id)
);

create table public.fee_structures (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  legacy_id   text not null,
  mode        text,
  target      text,
  class_name  text,
  section     text,
  fee_head    text not null,
  frequency   text,
  amount      numeric(12,2) not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  source      jsonb,
  unique (school_id, legacy_id)
);

create index fee_structures_target_idx on public.fee_structures (school_id, target);

create table public.fee_receipts (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  legacy_id        text not null,
  student_id       uuid references public.students(id) on delete set null,

  receipt_number   text,
  invoice_number   text,
  receipt_date     date,
  billing_month    text,
  billing_period   text,

  student_name     text,
  admission_number text,
  class_name       text,
  father_name      text,
  phone            text,
  fee_group        text,
  fee_card_no      text,
  fee_set_type     text,

  amount           numeric(12,2) not null default 0,
  discount         numeric(12,2) not null default 0,
  paid_amount      numeric(12,2) not null default 0,
  balance          numeric(12,2) not null default 0,
  total_due        numeric(12,2) not null default 0,
  method           text,
  status           text,
  payment_status   text,
  remark           text,

  fee_items        jsonb,
  payments         jsonb,

  send_sms         boolean not null default false,
  send_whatsapp    boolean not null default false,

  paid_at          timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  source           jsonb,
  unique (school_id, legacy_id)
);

create index fee_receipts_student_idx on public.fee_receipts (student_id);
create index fee_receipts_unpaid_idx  on public.fee_receipts (school_id, status) where deleted_at is null;
create index fee_receipts_period_idx  on public.fee_receipts (school_id, billing_period);

create table public.fee_fines (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  legacy_id  text not null,
  student_id uuid references public.students(id) on delete set null,
  amount     numeric(12,2) not null default 0,
  reason     text,
  created_at timestamptz not null default now(),
  source     jsonb,
  unique (school_id, legacy_id)
);

create table public.fee_counters (
  school_id uuid not null references public.schools(id) on delete cascade,
  name      text not null,
  value     bigint not null default 0,
  primary key (school_id, name)
);

-- ============ EXAMS / REPORTS ============

create table public.exams (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  legacy_id  text not null,
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source     jsonb,
  unique (school_id, legacy_id)
);

create table public.report_marks (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null references public.schools(id) on delete cascade,
  legacy_id            text not null,
  student_id           uuid references public.students(id) on delete cascade,
  exam_legacy_id       text,
  class_name           text,
  section              text,
  status               text,
  attendance           text,
  remarks              text,
  class_teacher_remark text,
  principal_remark     text,
  marks                jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  source               jsonb,
  unique (school_id, legacy_id)
);

create index report_marks_student_idx on public.report_marks (student_id);

create table public.report_cards (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null references public.schools(id) on delete cascade,
  legacy_id            text not null,
  student_id           uuid references public.students(id) on delete cascade,
  exam_legacy_id       text,
  report_number        text,
  class_name           text,
  section              text,
  status               text,
  locked               boolean not null default false,
  attendance           text,
  remarks              text,
  class_teacher_remark text,
  principal_remark     text,
  payload              jsonb,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  source               jsonb,
  unique (school_id, legacy_id)
);

create index report_cards_student_idx on public.report_cards (student_id);

create table public.date_sheets (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  legacy_id      text not null,
  exam_legacy_id text,
  class_name     text,
  section        text,
  subject        text,
  date           date,
  from_time      text,
  to_time        text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  source         jsonb,
  unique (school_id, legacy_id)
);

-- ============ CERTIFICATES ============

create table public.certificates (
  id                 uuid primary key default gen_random_uuid(),
  school_id          uuid not null references public.schools(id) on delete cascade,
  legacy_id          text not null,
  student_id         uuid references public.students(id) on delete set null,
  certificate_type   text not null,
  certificate_number text,
  admission_no       text,
  class_name         text,
  data               jsonb,
  created_by         text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  source             jsonb,
  unique (school_id, legacy_id)
);

create index certificates_student_idx on public.certificates (student_id);
create index certificates_type_idx    on public.certificates (school_id, certificate_type);

create table public.certificate_counters (
  school_id uuid not null references public.schools(id) on delete cascade,
  name      text not null,
  value     bigint not null default 0,
  primary key (school_id, name)
);

-- ============ HOMEWORK / NOTICES ============

create table public.homework (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools(id) on delete cascade,
  legacy_id   text not null,
  class_name  text,
  section     text,
  subject     text,
  title       text,
  description text,
  assigned_on date,
  due_date    date,
  created_by  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  source      jsonb,
  unique (school_id, legacy_id)
);

create index homework_class_idx on public.homework (school_id, class_name, section, assigned_on desc);

create table public.notices (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  legacy_id  text not null,
  title      text,
  body       text,
  audience   text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source     jsonb,
  unique (school_id, legacy_id)
);

-- ============ TRANSPORT ============

create table public.transport_allocations (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools(id) on delete cascade,
  legacy_id        text not null,
  student_id       uuid references public.students(id) on delete cascade,
  admission_no     text,
  class_name       text,
  route_id         text,
  route_name       text,
  stop_name        text,
  driver_id        text,
  pickup_time      text,
  drop_time        text,
  allocated_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  source           jsonb,
  unique (school_id, legacy_id)
);

-- ============ LEAVE / ADMISSIONS ============

create table public.leave_requests (
  id             uuid primary key default gen_random_uuid(),
  school_id      uuid not null references public.schools(id) on delete cascade,
  legacy_id      text not null,
  student_id     uuid references public.students(id) on delete cascade,
  parent_legacy  text,
  parent_name    text,
  admission_no   text,
  class_section  text,
  from_date      date,
  to_date        date,
  reason         text,
  status         text not null default 'pending',
  review_note    text,
  reviewed_at    timestamptz,
  reviewed_by    text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  source         jsonb,
  unique (school_id, legacy_id)
);

create index leave_requests_status_idx on public.leave_requests (school_id, status);

create table public.admission_requests (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools(id) on delete cascade,
  legacy_id         text not null,
  student_name      text,
  class_applied_for text,
  dob               date,
  gender            text,
  father_name       text,
  mother_name       text,
  parent_phone      text,
  parent_email      text,
  address           text,
  previous_school   text,
  admission_number  text,
  status            text not null default 'pending',
  review_note       text,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  source            jsonb,
  unique (school_id, legacy_id)
);

create index admission_requests_status_idx on public.admission_requests (school_id, status);

-- ============ STAFF ATTENDANCE ============

create table public.staff_attendance (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  staff_id   uuid not null references public.staff(id) on delete cascade,
  date       date not null,
  status     text not null,
  created_at timestamptz not null default now(),
  source     jsonb,
  unique (school_id, staff_id, date)
);

create index staff_attendance_date_idx on public.staff_attendance (school_id, date);

-- ============ PARENT NOTIFICATIONS ============

create table public.parent_notifications (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  legacy_id  text not null,
  parent_id  uuid references public.parents(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  type       text,
  title      text,
  body       text,
  read       boolean not null default false,
  created_at timestamptz not null default now(),
  source     jsonb,
  unique (school_id, legacy_id)
);

create index parent_notifications_parent_idx on public.parent_notifications (parent_id, created_at desc);

-- ============ SUBSCRIPTION / AUDIT ============

create table public.subscriptions (
  school_id  uuid primary key references public.schools(id) on delete cascade,
  plan       text,
  amount     numeric(12,2),
  status     text,
  starts_at  timestamptz,
  expires_at timestamptz,
  updated_at timestamptz not null default now(),
  source     jsonb
);

create table public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  school_id  uuid not null references public.schools(id) on delete cascade,
  legacy_id  text,
  actor      text,
  action     text,
  target     text,
  detail     jsonb,
  created_at timestamptz not null default now(),
  source     jsonb
);

create index audit_logs_school_idx on public.audit_logs (school_id, created_at desc);

-- ============ generic counters (admission etc.) ============

create table public.counters (
  school_id uuid not null references public.schools(id) on delete cascade,
  name      text not null,
  value     bigint not null default 0,
  primary key (school_id, name)
);

-- ============ updated_at triggers ============

do $$
declare t text;
begin
  foreach t in array array[
    'fee_groups','fee_structures','fee_receipts','exams','report_marks','report_cards',
    'date_sheets','certificates','homework','notices','transport_allocations',
    'leave_requests','admission_requests'
  ] loop
    execute format(
      'create trigger %I_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      t, t);
  end loop;
end $$;

-- ============ RLS lock ============

do $$
declare t text;
begin
  foreach t in array array[
    'fee_groups','fee_structures','fee_receipts','fee_fines','fee_counters',
    'exams','report_marks','report_cards','date_sheets',
    'certificates','certificate_counters','homework','notices','transport_allocations',
    'leave_requests','admission_requests','staff_attendance','parent_notifications',
    'subscriptions','audit_logs','counters'
  ] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
;
