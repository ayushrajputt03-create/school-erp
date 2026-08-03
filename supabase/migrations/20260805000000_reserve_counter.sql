-- Admission aur certificate number ka atomic counter.
--
-- App.jsx me teen counter the. Cutover me sirf fee receipt wala Supabase par
-- laaya gaya (reserve_receipt_sequence); admission aur certificate wale abhi
-- bhi seedhe Firebase RTDB ke REST par ETag/If-Match loop chala rahe the. Us
-- URL par Supabase ka token 401 deta hai, isliye Supabase par har admission
-- "Could not generate admission number." par mar raha tha, aur certificate ka
-- bhi wahi haal hota (bas abhi tak kisi ne banaya nahi tha).
--
-- Ye ek hi function dono ke liye hai, taaki teesri jagah wahi ETag loop dobara
-- na likhna pade. Table pehle se maujood `fee_counters` hi hai — usme (school,
-- name) par unique hai, to naam ke hisaab se kitne bhi counter rakh sakte hain.
-- Naam fee-specific hai, par rename karne se reserve_receipt_sequence hilta,
-- aur wo paise ka raasta hai — isliye table waisa hi chhoda.
--
-- SABSE ZAROORI BAAT — floor server par nikalta hai, client ke bheje seed par
-- bharosa nahi:
--   Production me dono school ke admissionCounter me lastIssued = 0 pada hai
--   (kabhi seed hua hi nahi). Sirf counter dekh kar chalte to Triveni ko agla
--   admission number 1 milta — jabki wahan 771 student hain aur 777 tak number
--   ja chuka hai. Yaani maujooda bachchon ke number dobara issue ho jaate.
--   Isliye counter khaali/peechhe ho to asli table se max poochha jaata hai.
--
-- Firebase wala code `students` node padhta tha jo sirf active students deta
-- hai. Yahan soft-deleted bhi gine jaate hain — trash me pade bachche ka
-- admission number kisi naye ko de dena purane record se takra jaata.

create or replace function public.reserve_counter(
  p_school uuid,
  p_name   text,
  p_seed   bigint default 0
)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_floor bigint;
  v_next  bigint;
begin
  if p_school is null or coalesce(p_name, '') = '' then
    raise exception 'school id aur counter ka naam dono chahiye';
  end if;

  if p_school <> public.current_school_id() or not public.is_school_admin() then
    raise exception 'is school ka number lene ki ijazat nahi';
  end if;

  -- client ki nazar me jo sabse bada number hai
  v_floor := greatest(coalesce(p_seed, 0), 0);

  -- ...aur DB me jo sach me sabse bada hai. Dono me se bada jeetta hai.
  -- Regex App.jsx ke admissionValue() jaisa hi hai: sirf aakhir ke ank
  -- (`(\d+)$`), taaki "NPS/2026/015" aur "015" ek hi number dein.
  if p_name = 'admission' then
    select greatest(
             v_floor,
             coalesce(max(nullif(substring(coalesce(admission_number, '') from '(\d+)$'), '')::bigint), 0)
           )
      into v_floor
      from public.students
     where school_id = p_school;

  elsif p_name like 'certificate:%' then
    select greatest(
             v_floor,
             coalesce(max(nullif(substring(coalesce(certificate_number, '') from '(\d+)$'), '')::bigint), 0)
           )
      into v_floor
      from public.certificates
     where school_id = p_school
       and certificate_type = split_part(p_name, ':', 2);
  end if;

  -- Ek hi statement, isliye utna hi atomic jitna RTDB ka runTransaction tha:
  -- do log ek saath student add karein to dono ko alag number milta hai.
  -- Counter kabhi peechhe nahi jaata (greatest), to purana number dobara nahi milta.
  insert into public.fee_counters (school_id, name, value)
       values (p_school, p_name, v_floor + 1)
  on conflict (school_id, name)
    do update set value = greatest(public.fee_counters.value, v_floor) + 1
    returning value into v_next;

  return v_next;
end $function$;

revoke all on function public.reserve_counter(uuid, text, bigint) from public, anon;
grant execute on function public.reserve_counter(uuid, text, bigint) to authenticated;
