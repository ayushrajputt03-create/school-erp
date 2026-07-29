-- Fee receipt number ka counter. Ye Firebase ke runTransaction ki jagah hai.
--
-- Zaroori kyun: do log ek saath receipt banayen to dono ko ek hi number NAHI
-- milna chahiye. Memory me se sabse bada number nikal ke +1 karna race karta hai
-- (dono ek hi number padhte hain, dono wahi likh dete hain).
--
-- `on conflict do update` ek hi statement me atomic hai — Postgres us row par
-- lock leta hai, doosra bhejne wala intezaar karta hai aur agla number paata hai.
-- greatest() isliye ki counter kabhi peeche na jaaye: purani receipts jo number
-- pehle hi use kar chuki hain, wo dobara na milen.
create or replace function public.reserve_receipt_sequence(p_school uuid, p_seed bigint)
returns bigint
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_next bigint;
begin
  if p_school is null then
    raise exception 'school id chahiye';
  end if;

  -- apne hi school ke liye, aur sirf admin
  if p_school <> public.current_school_id() or not public.is_school_admin() then
    raise exception 'is school ka receipt number lene ki ijazat nahi';
  end if;

  insert into public.fee_counters (school_id, name, value)
       values (p_school, 'receipt', greatest(coalesce(p_seed, 0), 0) + 1)
  on conflict (school_id, name)
    do update set value = greatest(public.fee_counters.value, coalesce(p_seed, 0)) + 1,
                  updated_at = now()
    returning value into v_next;

  return v_next;
end $$;

revoke all on function public.reserve_receipt_sequence(uuid, bigint) from public;
grant execute on function public.reserve_receipt_sequence(uuid, bigint) to authenticated;;
