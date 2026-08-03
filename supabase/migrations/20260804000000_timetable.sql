-- ============================================================
-- Period-wise timetable: `periods` (school ka ghanti-schedule) aur
-- `timetable_slots` (kis class ke kis period me kaun sa subject, kaun teacher).
--
-- Ye dono nayi tables hain — kisi maujooda table ko haath nahi lagaya ja raha,
-- aur purana TimetableManager (PDF/image upload wali list) waise ka waisa chalta
-- rahega. Uska data alag jagah hai, ye uske upar aata hai, uski jagah nahi.
--
-- Kyun `class_name`/`section` text hain, `class_id`/`section_id` nahi:
-- is app me classes aur sections kabhi table bane hi nahi. schoolOptions.js me
-- wo plain strings hain ('10', 'A') aur students, staff, attendance, fees —
-- sab wahi string rakhte hain. Yahan uuid FK banane ke liye pehle teen master
-- tables banani padtin, aur phir timetable poore app se alag bhasha bolta.
-- Text rakhne se ye din se hi baaki sab se match karta hai. Master table baad
-- me chahiye to ek nullable class_id column additive tarike se juda ja sakta
-- hai — aaj ka data tab bhi padha jaayega.
-- ============================================================

-- ── periods ─────────────────────────────────────────────────
-- School bhar ka ek hi ghanti-schedule. Period 1 = 9:00-9:45, waghera.
-- is_break = wo period jisme padhai nahi hoti (break/lunch) — uske liye slot
-- banta hi nahi, grid us row ko seedhe "Break" dikha deta hai.
create table if not exists public.periods (
  id            uuid primary key default gen_random_uuid(),
  school_id     uuid not null references public.schools(id) on delete cascade,
  period_number smallint not null check (period_number between 1 and 20),
  start_time    time not null,
  end_time      time not null,
  is_break      boolean not null default false,
  label         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Ek school me period 2 do baar nahi ho sakta.
  constraint periods_school_number_key unique (school_id, period_number),
  -- 9:45 se 9:00 tak ka period galti hai, chup-chaap save nahi hona chahiye.
  constraint periods_time_order_check check (end_time > start_time)
);

-- ── timetable_slots ─────────────────────────────────────────
-- Ek row = "is class-section ka is din ke is period me ye subject, ye teacher".
--
-- teacher_name jaan-boojh kar denormalise kiya hua hai. teacher_id hi sach hai,
-- par staff record hat jaane par bhi grid me "kaun padha raha tha" dikhna
-- chahiye — warna admin ke saamne khaali cell aata hai aur pata hi nahi chalta
-- ki wahan kuch tha. Slot save hote waqt naam dobara likh diya jaata hai.
create table if not exists public.timetable_slots (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools(id) on delete cascade,
  class_name   text not null,
  section      text not null,
  -- 1 = Monday ... 6 = Saturday. Number isliye ki "order by day_of_week, start_time"
  -- seedhe sahi kram deta hai; naam se sort karne par Friday pehle aa jaata.
  day_of_week  smallint not null check (day_of_week between 1 and 6),
  period_id    uuid not null references public.periods(id) on delete cascade,
  subject      text not null,
  -- Teacher ka staff record hat jaaye to slot marta nahi — subject aur
  -- teacher_name bache rehte hain, bas link tootta hai aur admin dobara chun
  -- leta hai. (fee_receipts wali baat yahan laagu nahi hoti: wahan SET NULL se
  -- paisa kiska tha ye ud jaata tha; yahan koi hisaab ka record nahi hai.)
  teacher_id   uuid references public.staff(id) on delete set null,
  teacher_name text,
  room         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  -- Ek class-section ke ek din ke ek period me do subject nahi ho sakte.
  constraint timetable_slots_class_slot_key
    unique (school_id, class_name, section, day_of_week, period_id)
);

-- Teacher ek waqt par do kamron me nahi ho sakta. UI save se pehle warning
-- dikhata hai, par asli rok yahan hai — do admin ek saath alag-alag class me
-- wahi teacher lagayein to UI ki jaanch dono baar paas ho jaati aur database me
-- clash bach jaata. Partial index isliye ki teacher_id NULL walon par ye niyam
-- laagu nahi hota (unassigned slots kitne bhi ho sakte hain).
create unique index if not exists timetable_slots_teacher_clash_key
  on public.timetable_slots (school_id, day_of_week, period_id, teacher_id)
  where teacher_id is not null;

-- Do hi raaste se padha jaata hai: ek class-section ka poora hafta, ya ek
-- teacher ka poora hafta. Dono ke liye ek-ek index.
create index if not exists timetable_slots_class_idx
  on public.timetable_slots (school_id, class_name, section);
create index if not exists timetable_slots_teacher_idx
  on public.timetable_slots (school_id, teacher_id)
  where teacher_id is not null;

-- ── updated_at ──────────────────────────────────────────────
drop trigger if exists periods_set_updated_at on public.periods;
create trigger periods_set_updated_at
  before update on public.periods
  for each row execute function public.set_updated_at();

drop trigger if exists timetable_slots_set_updated_at on public.timetable_slots;
create trigger timetable_slots_set_updated_at
  before update on public.timetable_slots
  for each row execute function public.set_updated_at();

-- ── RLS ─────────────────────────────────────────────────────
-- Wahi shakal jo homework/notices par hai: apne school ka sab koi padh sakta
-- hai (teacher ko apna timetable dikhna hi chahiye), likhna sirf admin.
-- current_school_id() / is_school_admin() ko `select` me lapeta gaya hai taaki
-- Postgres inhe har row par nahi, query me ek baar chalaye (migration 0012).
alter table public.periods enable row level security;
alter table public.timetable_slots enable row level security;

drop policy if exists periods_read on public.periods;
create policy periods_read on public.periods
  for select using (school_id = (select public.current_school_id()));

drop policy if exists periods_ins on public.periods;
create policy periods_ins on public.periods
  for insert with check (
    school_id = (select public.current_school_id()) and (select public.is_school_admin())
  );

drop policy if exists periods_upd on public.periods;
create policy periods_upd on public.periods
  for update using (
    school_id = (select public.current_school_id()) and (select public.is_school_admin())
  ) with check (
    school_id = (select public.current_school_id()) and (select public.is_school_admin())
  );

drop policy if exists periods_del on public.periods;
create policy periods_del on public.periods
  for delete using (
    school_id = (select public.current_school_id()) and (select public.is_school_admin())
  );

drop policy if exists timetable_slots_read on public.timetable_slots;
create policy timetable_slots_read on public.timetable_slots
  for select using (school_id = (select public.current_school_id()));

drop policy if exists timetable_slots_ins on public.timetable_slots;
create policy timetable_slots_ins on public.timetable_slots
  for insert with check (
    school_id = (select public.current_school_id()) and (select public.is_school_admin())
  );

drop policy if exists timetable_slots_upd on public.timetable_slots;
create policy timetable_slots_upd on public.timetable_slots
  for update using (
    school_id = (select public.current_school_id()) and (select public.is_school_admin())
  ) with check (
    school_id = (select public.current_school_id()) and (select public.is_school_admin())
  );

drop policy if exists timetable_slots_del on public.timetable_slots;
create policy timetable_slots_del on public.timetable_slots
  for delete using (
    school_id = (select public.current_school_id()) and (select public.is_school_admin())
  );
