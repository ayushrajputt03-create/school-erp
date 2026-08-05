-- schools.source me logo/seal ki base64 nakal padi thi.
--
-- Ye images pehle hi school-assets bucket me jaa chuki hain aur unki URL
-- logo_url / seal_url columns me hai. Adapter ka GET in columns se hi bharta
-- hai (`logoURL: data.logo_url`), yaani source wali base64 download hoti thi
-- aur turant phenk di jaati thi. Ek school ka source 323 kB ka tha, jisme
-- 302 kB akela logo tha — aur `schools/{id}/profile` har login par padha
-- jaata hai (App.jsx:2565 aur TeacherApp.jsx:105), GET `select('*')` ke saath.
-- Poore app ka sabse bada egress kharcha yahi tha, aur bilkul bekaar tha.
--
-- Safety:
--   1. Poora purana source schools_source_backup_20260807 me copy ho raha hai.
--      Kuch bhi galat nikla to wahan se jyon ka tyon wapas laya ja sakta hai.
--   2. Sirf wahi key hatti hai jiska column me asli storage URL maujood ho.
--      Jis base64 ka koi backup nahi (orphan) wo jyon ki tyon rehti hai —
--      dry run me aisi ek bhi nahi mili, par shart phir bhi lagi hai taaki
--      ye migration kal ke naye data par bhi surakshit rahe.
--
-- Dobara likhne se rokne ka kaam dataAdapter.js ka liftProfileAssets() karta
-- hai: profile save par base64 pehle bucket me jaata hai, source me sirf URL.

create table if not exists schools_source_backup_20260807 (
  school_id uuid primary key,
  source jsonb not null,
  backed_up_at timestamptz not null default now()
);

-- Koi policy nahi = anon/authenticated ke liye poori tarah band. Ye table sirf
-- recovery ke liye hai, app ise kabhi nahi padhta.
alter table schools_source_backup_20260807 enable row level security;

insert into schools_source_backup_20260807 (school_id, source)
select id, source from schools where source is not null
on conflict (school_id) do nothing;

with plan as (
  select s.id,
    array_remove(array[
      case when s.source->>'logoURL' like 'data:%' and s.logo_url is not null and s.logo_url not like 'data:%' then 'logoURL' end,
      case when s.source->>'logo'    like 'data:%' and s.logo_url is not null and s.logo_url not like 'data:%' then 'logo' end,
      case when s.source->>'logoUrl' like 'data:%' and s.logo_url is not null and s.logo_url not like 'data:%' then 'logoUrl' end,
      case when s.source->>'schoolSealURL' like 'data:%' and s.seal_url is not null and s.seal_url not like 'data:%' then 'schoolSealURL' end,
      case when s.source->>'principalSignatureURL' like 'data:%' and s.principal_signature_url is not null and s.principal_signature_url not like 'data:%' then 'principalSignatureURL' end
    ], null) as strip_keys
  from schools s
)
update schools s
set source = (
  select coalesce(jsonb_object_agg(k, v), '{}'::jsonb)
  from jsonb_each(s.source) e(k, v)
  where not (k = any(p.strip_keys))
)
from plan p
where p.id = s.id and array_length(p.strip_keys, 1) > 0;

-- timetable_slots ke do foreign key bina index ke the (advisor lint 0001).
-- Period ya teacher delete karte waqt Postgres ko poori table scan karni
-- padti thi, aur teacher ka apna timetable nikaalna bhi seq scan tha.
create index if not exists timetable_slots_period_idx  on timetable_slots (period_id);
create index if not exists timetable_slots_teacher_idx on timetable_slots (teacher_id);
