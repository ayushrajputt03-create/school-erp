-- ============================================================
-- 0020 — kv me nested key ko ek hi statement me set/delete karna
--
-- Parent portal ke parentSessions, parentLoginAttempts aur parentStudentIndex
-- kisi table me nahi hain — poore school ka EK kv row hai jisme har parent ek
-- key hai. RTDB me har path apna alag node tha, isliye do parent ek saath login
-- karein to koi dikkat nahi thi.
--
-- Server par read-modify-write karne se wo suraksha chali jaati: dono request
-- purani value padhtin, dono apna session jodtin, aur baad wali pehle wale ko
-- mita deti — parent ko turant "session expired" milta. Ye do function wahi
-- kaam Postgres ke andar ek statement me karte hain, to race bachti hi nahi.
--
-- jsonb_deep_set 0019 se aata hai. Sadha jsonb_set yahan kaam nahi karta:
-- create_missing sirf AAKHRI key banata hai, beech ke object nahi — pehli baar
-- session banate waqt likhaayi chupchaap gir jaati.
--
-- security invoker (default) hi rakha hai. Ye sirf service_role ko diye gaye
-- hain, jo waise bhi RLS se bahar hai; definer banane se anon ke haath lagne
-- par kv ki RLS bhi bekaar ho jaati.
-- ============================================================

create or replace function public.kv_deep_set(p_school uuid, p_path text, p_keys text[], p_value jsonb)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  next_value jsonb;
begin
  insert into public.kv (school_id, path, value)
  values (p_school, p_path, public.jsonb_deep_set('{}'::jsonb, p_keys, p_value))
  on conflict (school_id, path) do update
     set value = public.jsonb_deep_set(coalesce(public.kv.value, '{}'::jsonb), p_keys, p_value),
         updated_at = now()
  returning value into next_value;
  return next_value;
end
$$;

create or replace function public.kv_deep_del(p_school uuid, p_path text, p_keys text[])
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  next_value jsonb;
begin
  update public.kv
     set value = coalesce(value, '{}'::jsonb) #- p_keys,
         updated_at = now()
   where school_id = p_school and path = p_path
  returning value into next_value;
  return coalesce(next_value, '{}'::jsonb);
end
$$;

revoke all on function public.kv_deep_set(uuid, text, text[], jsonb) from public, anon, authenticated;
revoke all on function public.kv_deep_del(uuid, text, text[]) from public, anon, authenticated;
grant execute on function public.kv_deep_set(uuid, text, text[], jsonb) to service_role;
grant execute on function public.kv_deep_del(uuid, text, text[]) to service_role;
;
