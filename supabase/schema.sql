<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
<<<<<<< ours
-- Multi-tenant billing SaaS schema with shop isolation and subscriptions
create extension if not exists "uuid-ossp";

create table if not exists shops (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  address text,
  created_at timestamptz default now()
);

create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  shop_id uuid not null references shops(id) on delete cascade,
  full_name text,
  role text not null check (role in ('owner','staff','saas_admin')),
  created_at timestamptz default now()
);

create table if not exists plans (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  name text not null,
  monthly_price numeric not null,
  yearly_price numeric not null,
  invoice_limit int,
  staff_limit int,
  feature_flags jsonb default '{}'::jsonb
);

create table if not exists subscriptions (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  plan_id uuid not null references plans(id),
  status text not null check (status in ('active','expired','cancelled','trial')),
  start_date date not null,
  end_date date not null,
  billing_cycle text check (billing_cycle in ('monthly','yearly','trial')),
  created_at timestamptz default now()
);

create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  product_name text not null,
  category text,
  barcode text,
  purchase_price numeric not null,
  selling_price numeric not null,
  gst_percent numeric default 0,
  stock_quantity numeric default 0,
  low_stock_limit numeric default 0,
  created_at timestamptz default now()
);

create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  name text not null,
  phone text,
  credit_balance numeric default 0,
  created_at timestamptz default now()
);

create table if not exists invoices (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  invoice_number text not null,
  customer_id uuid references customers(id),
  created_by uuid references users(id),
  payment_mode text not null,
  subtotal numeric not null,
  discount numeric default 0,
  gst_total numeric default 0,
  grand_total numeric not null,
  created_at timestamptz default now(),
  unique (shop_id, invoice_number)
);

create table if not exists invoice_items (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  invoice_id uuid not null references invoices(id) on delete cascade,
  product_id uuid not null references products(id),
  qty numeric not null,
  purchase_price numeric not null,
  selling_price numeric not null,
  gst_percent numeric default 0,
  line_total numeric not null
);

create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  invoice_id uuid references invoices(id) on delete cascade,
  amount numeric not null,
  mode text not null,
  status text default 'paid',
  paid_at timestamptz default now()
);

create table if not exists stock_movements (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  product_id uuid not null references products(id),
  movement_type text not null,
  quantity numeric not null,
  note text,
  created_at timestamptz default now()
);

create table if not exists shop_users (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  is_active boolean default true,
  unique (shop_id, user_id)
);

create table if not exists usage_limits (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  month_key text not null,
  invoices_used int default 0,
  staff_used int default 0,
  unique (shop_id, month_key)
);

create table if not exists payment_history (
  id uuid primary key default uuid_generate_v4(),
  shop_id uuid not null references shops(id) on delete cascade,
  subscription_id uuid references subscriptions(id),
  amount numeric not null,
  currency text default 'INR',
  status text not null,
  paid_at timestamptz default now(),
  gateway_ref text
);

alter table shops enable row level security;
alter table users enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table invoices enable row level security;
alter table invoice_items enable row level security;
alter table payments enable row level security;
alter table stock_movements enable row level security;
alter table subscriptions enable row level security;
alter table plans enable row level security;
alter table shop_users enable row level security;
alter table usage_limits enable row level security;
alter table payment_history enable row level security;

create or replace function public.current_shop_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select shop_id from public.users where id = auth.uid()
$$;

create or replace function public.is_saas_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'saas_admin'
  )
$$;

drop policy if exists "plans_read" on plans;
drop policy if exists "plans_admin_write" on plans;
drop policy if exists "shops_read_own_or_admin" on shops;
drop policy if exists "shops_update_owner_or_admin" on shops;
drop policy if exists "users_read_shop_or_self_or_admin" on users;
drop policy if exists "users_write_admin" on users;
drop policy if exists "subscriptions_shop_or_admin_read" on subscriptions;
drop policy if exists "subscriptions_admin_write" on subscriptions;
drop policy if exists "shop_users_shop_or_admin_read" on shop_users;
drop policy if exists "shop_users_admin_write" on shop_users;
drop policy if exists "usage_limits_shop_or_admin_read" on usage_limits;
drop policy if exists "usage_limits_shop_or_admin_write" on usage_limits;
drop policy if exists "payment_history_shop_or_admin_read" on payment_history;
drop policy if exists "payment_history_admin_write" on payment_history;
drop policy if exists "products_shop_read" on products;
drop policy if exists "products_shop_write" on products;
drop policy if exists "customers_shop_read" on customers;
drop policy if exists "customers_shop_write" on customers;
drop policy if exists "invoices_shop_read" on invoices;
drop policy if exists "invoices_shop_write" on invoices;
drop policy if exists "invoice_items_shop_read" on invoice_items;
drop policy if exists "invoice_items_shop_write" on invoice_items;
drop policy if exists "payments_shop_read" on payments;
drop policy if exists "payments_shop_write" on payments;
drop policy if exists "stock_movements_shop_read" on stock_movements;
drop policy if exists "stock_movements_shop_write" on stock_movements;

create policy "plans_read" on plans
  for select using (true);

create policy "plans_admin_write" on plans
  for all using (public.is_saas_admin())
  with check (public.is_saas_admin());

create policy "shops_read_own_or_admin" on shops
  for select using (id = public.current_shop_id() or public.is_saas_admin());

create policy "shops_update_owner_or_admin" on shops
  for update using (id = public.current_shop_id() or public.is_saas_admin())
  with check (id = public.current_shop_id() or public.is_saas_admin());

create policy "users_read_shop_or_self_or_admin" on users
  for select using (
    id = auth.uid()
    or shop_id = public.current_shop_id()
    or public.is_saas_admin()
  );

create policy "users_write_admin" on users
  for all using (public.is_saas_admin())
  with check (public.is_saas_admin());

create policy "subscriptions_shop_or_admin_read" on subscriptions
  for select using (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "subscriptions_admin_write" on subscriptions
  for all using (public.is_saas_admin())
  with check (public.is_saas_admin());

create policy "shop_users_shop_or_admin_read" on shop_users
  for select using (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "shop_users_admin_write" on shop_users
  for all using (public.is_saas_admin())
  with check (public.is_saas_admin());

create policy "usage_limits_shop_or_admin_read" on usage_limits
  for select using (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "usage_limits_shop_or_admin_write" on usage_limits
  for all using (shop_id = public.current_shop_id() or public.is_saas_admin())
  with check (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "payment_history_shop_or_admin_read" on payment_history
  for select using (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "payment_history_admin_write" on payment_history
  for all using (public.is_saas_admin())
  with check (public.is_saas_admin());

create policy "products_shop_read" on products
  for select using (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "products_shop_write" on products
  for all using (shop_id = public.current_shop_id() or public.is_saas_admin())
  with check (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "customers_shop_read" on customers
  for select using (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "customers_shop_write" on customers
  for all using (shop_id = public.current_shop_id() or public.is_saas_admin())
  with check (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "invoices_shop_read" on invoices
  for select using (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "invoices_shop_write" on invoices
  for all using (shop_id = public.current_shop_id() or public.is_saas_admin())
  with check (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "invoice_items_shop_read" on invoice_items
  for select using (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "invoice_items_shop_write" on invoice_items
  for all using (shop_id = public.current_shop_id() or public.is_saas_admin())
  with check (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "payments_shop_read" on payments
  for select using (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "payments_shop_write" on payments
  for all using (shop_id = public.current_shop_id() or public.is_saas_admin())
  with check (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "stock_movements_shop_read" on stock_movements
  for select using (shop_id = public.current_shop_id() or public.is_saas_admin());

create policy "stock_movements_shop_write" on stock_movements
  for all using (shop_id = public.current_shop_id() or public.is_saas_admin())
  with check (shop_id = public.current_shop_id() or public.is_saas_admin());
=======
=======
>>>>>>> theirs
create extension if not exists pgcrypto;
create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_code varchar(8) unique not null,
  status text not null default 'active',
=======
=======
>>>>>>> theirs
create extension if not exists pgcrypto;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_code varchar(8) unique not null check (school_code ~ '^[A-Z0-9]{6,8}$'),
  status text not null default 'active' check (status in ('active','suspended')),
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
  base_price_per_student numeric(10,2) not null default 4.00,
  created_at timestamptz not null default now()
);

<<<<<<< ours
<<<<<<< ours
create table if not exists public.roles (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, name text not null, unique(school_id,name));
create table if not exists public.users (id uuid primary key references auth.users(id), school_id uuid not null references schools(id) on delete cascade, role_id uuid not null references roles(id), email text, phone text, full_name text not null, is_active boolean not null default true, created_at timestamptz default now());
create table if not exists public.students (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, user_id uuid unique references users(id), admission_no text, class_id uuid, section_id uuid, is_active boolean default true);
create table if not exists public.parents (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, user_id uuid unique references users(id), student_id uuid references students(id));
create table if not exists public.teachers (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, user_id uuid unique references users(id), employee_code text);
create table if not exists public.classes (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, name text not null, class_teacher_id uuid references teachers(id));
create table if not exists public.sections (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, class_id uuid references classes(id), name text not null);
create table if not exists public.attendance (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, student_id uuid not null references students(id), date date not null, status text not null, marked_by uuid references users(id));
create table if not exists public.fees (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, student_id uuid not null references students(id), term text, amount numeric(10,2), due_date date, status text default 'pending');
=======
=======
>>>>>>> theirs
create table if not exists public.roles (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, name text not null check (name in ('super_admin','principal','teacher','student','parent')), unique(school_id,name));
create table if not exists public.users (id uuid primary key references auth.users(id), school_id uuid not null references schools(id) on delete cascade, role_id uuid not null references roles(id), email text, phone text, full_name text not null, is_active boolean not null default true, created_at timestamptz default now());
create table if not exists public.classes (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, name text not null, class_teacher_id uuid);
create table if not exists public.sections (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, class_id uuid references classes(id), name text not null);
create table if not exists public.students (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, user_id uuid unique references users(id), admission_no text, class_id uuid references classes(id), section_id uuid references sections(id), is_active boolean default true);
create table if not exists public.parents (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, user_id uuid unique references users(id), student_id uuid references students(id));
create table if not exists public.teachers (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, user_id uuid unique references users(id), employee_code text);
create table if not exists public.attendance (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, student_id uuid not null references students(id), date date not null, status text not null check(status in ('present','absent','late')), marked_by uuid references users(id));
create table if not exists public.fees (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, student_id uuid not null references students(id), term text, amount numeric(10,2), due_date date, status text default 'pending' check(status in ('pending','partial','paid')));
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
create table if not exists public.fee_payments (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, fee_id uuid not null references fees(id), amount numeric(10,2), paid_on date);
create table if not exists public.subjects (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, class_id uuid references classes(id), name text not null);
create table if not exists public.marks (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, student_id uuid references students(id), subject_id uuid references subjects(id), exam_name text, marks_obtained numeric(5,2), max_marks numeric(5,2));
create table if not exists public.homework (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, class_id uuid references classes(id), title text, description text, due_date date, created_by uuid references users(id));
create table if not exists public.notices (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, title text, body text, audience text, created_by uuid references users(id), created_at timestamptz default now());
create table if not exists public.pricing_rules (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, custom_price_per_student numeric(10,2), discount_percent numeric(5,2), is_trial boolean default false, effective_from date not null default current_date);
create table if not exists public.subscriptions (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, plan_name text default 'Standard', status text default 'active', current_period_start date, current_period_end date);
<<<<<<< ours
<<<<<<< ours
create table if not exists public.invoices (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, billing_month date not null, active_students int not null, unit_price numeric(10,2) not null, total_amount numeric(10,2) not null, status text default 'unpaid');

create or replace function public.current_school_id() returns uuid language sql stable as $$
  select school_id from public.users where id = auth.uid()
$$;
create or replace function public.has_role(role_name text) returns boolean language sql stable as $$
  select exists(select 1 from public.users u join public.roles r on r.id=u.role_id where u.id=auth.uid() and r.name=role_name)
$$;
=======
create extension if not exists "pgcrypto";

create table public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  school_code varchar(8) unique not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null check (name in ('super_admin','principal','teacher','student','parent')),
  unique (school_id, name)
);

create table public.users (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  role_id uuid not null references roles(id),
  full_name text not null,
  email text,
  phone text,
  password_hash text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  admission_no text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table public.parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade
);

create table public.teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  employee_code text not null
);

create table public.classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null
);
create table public.sections (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  class_id uuid not null references classes(id) on delete cascade,
  name text not null
);
create table public.attendance (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, student_id uuid not null references students(id), date date not null, status text not null);
create table public.fees (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, student_id uuid not null references students(id), amount numeric(10,2) not null, due_date date not null, status text default 'pending');
create table public.fee_payments (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, fee_id uuid not null references fees(id), amount numeric(10,2) not null, paid_at timestamptz default now());
create table public.subjects (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, class_id uuid not null references classes(id), name text not null);
create table public.marks (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, student_id uuid not null references students(id), subject_id uuid not null references subjects(id), score numeric(5,2) not null);
create table public.homework (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, class_id uuid not null references classes(id), title text not null, description text, due_date date);
create table public.notices (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, title text not null, content text not null, created_at timestamptz default now());
create table public.subscriptions (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, plan_name text not null default 'default', status text not null default 'active', started_at date default current_date);
create table public.pricing_rules (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, price_per_student numeric(10,2) not null default 4, discount_percent numeric(5,2) default 0, effective_from date not null default current_date);
create table public.invoices (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, month date not null, active_students int not null, price_per_student numeric(10,2) not null, total_amount numeric(12,2) generated always as (active_students * price_per_student) stored, status text not null default 'unpaid', created_at timestamptz default now());
>>>>>>> theirs

alter table public.schools enable row level security;
alter table public.roles enable row level security;
alter table public.users enable row level security;
alter table public.students enable row level security;
alter table public.parents enable row level security;
alter table public.teachers enable row level security;
alter table public.classes enable row level security;
alter table public.sections enable row level security;
alter table public.attendance enable row level security;
alter table public.fees enable row level security;
alter table public.fee_payments enable row level security;
alter table public.subjects enable row level security;
alter table public.marks enable row level security;
alter table public.homework enable row level security;
alter table public.notices enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices enable row level security;
alter table public.pricing_rules enable row level security;

<<<<<<< ours
create policy "same school select" on public.students for select using (school_id = public.current_school_id());
create policy "same school modify" on public.students for all using (school_id = public.current_school_id()) with check (school_id = public.current_school_id());

create policy "super admin schools" on public.schools for all using (public.has_role('super_admin')) with check (public.has_role('super_admin'));
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
=======
>>>>>>> theirs
create table if not exists public.invoices (id uuid primary key default gen_random_uuid(), school_id uuid not null references schools(id) on delete cascade, billing_month date not null, active_students int not null, unit_price numeric(10,2) not null, total_amount numeric(10,2) not null, status text default 'unpaid' check(status in ('unpaid','paid','overdue')));

create or replace function public.current_school_id() returns uuid language sql stable as $$ select school_id from public.users where id = auth.uid() $$;
create or replace function public.has_role(role_name text) returns boolean language sql stable as $$ select exists(select 1 from public.users u join public.roles r on r.id=u.role_id where u.id=auth.uid() and r.name=role_name) $$;

create or replace function public.generate_school_code() returns text language plpgsql as $$
declare code text;
begin
  loop
    code := upper(substr(md5(random()::text),1,3)) || (1000 + floor(random()*9000))::int::text;
    exit when not exists (select 1 from public.schools where school_code = code);
  end loop;
  return code;
end $$;

create or replace function public.calculate_monthly_bill(target_school uuid, target_month date)
returns table(active_students int, unit_price numeric, total_amount numeric)
language sql stable as $$
  with st as (
    select count(*)::int as cnt from public.students where school_id = target_school and is_active = true
  ), pr as (
    select coalesce((select custom_price_per_student from public.pricing_rules where school_id = target_school and effective_from <= target_month order by effective_from desc limit 1),(select base_price_per_student from public.schools where id = target_school),4.00) as p
  )
  select st.cnt, pr.p, round(st.cnt * pr.p, 2) from st, pr
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['schools','roles','users','students','parents','teachers','classes','sections','attendance','fees','fee_payments','subjects','marks','homework','notices','subscriptions','invoices','pricing_rules']
  LOOP
    EXECUTE format('alter table public.%I enable row level security', t);
  END LOOP;
END $$;

create policy if not exists school_isolation_schools on public.schools for select using (id = public.current_school_id() or public.has_role('super_admin'));
create policy if not exists school_isolation_students on public.students for all using (school_id = public.current_school_id() or public.has_role('super_admin')) with check (school_id = public.current_school_id() or public.has_role('super_admin'));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['roles','users','parents','teachers','classes','sections','attendance','fees','fee_payments','subjects','marks','homework','notices','subscriptions','invoices','pricing_rules']
  LOOP
    EXECUTE format('create policy if not exists school_isolation_%s on public.%I for all using (school_id = public.current_school_id() or public.has_role(''super_admin'')) with check (school_id = public.current_school_id() or public.has_role(''super_admin''))', t, t);
  END LOOP;
END $$;
<<<<<<< ours
>>>>>>> theirs
=======
>>>>>>> theirs
=======
create function public.current_school_id() returns uuid language sql stable as $$
  select nullif(current_setting('app.current_school_id', true), '')::uuid;
$$;

create policy school_isolation on public.users using (school_id = public.current_school_id());
create policy school_isolation_students on public.students using (school_id = public.current_school_id());
create policy school_isolation_teachers on public.teachers using (school_id = public.current_school_id());
create policy school_isolation_classes on public.classes using (school_id = public.current_school_id());
create policy school_isolation_sections on public.sections using (school_id = public.current_school_id());
create policy school_isolation_attendance on public.attendance using (school_id = public.current_school_id());
create policy school_isolation_fees on public.fees using (school_id = public.current_school_id());
create policy school_isolation_payments on public.fee_payments using (school_id = public.current_school_id());
create policy school_isolation_subjects on public.subjects using (school_id = public.current_school_id());
create policy school_isolation_marks on public.marks using (school_id = public.current_school_id());
create policy school_isolation_homework on public.homework using (school_id = public.current_school_id());
create policy school_isolation_notices on public.notices using (school_id = public.current_school_id());
create policy school_isolation_subscriptions on public.subscriptions using (school_id = public.current_school_id());
create policy school_isolation_invoices on public.invoices using (school_id = public.current_school_id());
create policy school_isolation_pricing on public.pricing_rules using (school_id = public.current_school_id());
create policy school_isolation_roles on public.roles using (school_id = public.current_school_id());

-- super_admin bypass should be handled from service-role APIs only.
>>>>>>> theirs
