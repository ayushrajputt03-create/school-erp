-- fee_counters me updated_at column hai hi nahi — pichhle version me wo likha tha,
-- jo pehli hi asli receipt par phat jaata.
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

  if p_school <> public.current_school_id() or not public.is_school_admin() then
    raise exception 'is school ka receipt number lene ki ijazat nahi';
  end if;

  insert into public.fee_counters (school_id, name, value)
       values (p_school, 'receipt', greatest(coalesce(p_seed, 0), 0) + 1)
  on conflict (school_id, name)
    do update set value = greatest(public.fee_counters.value, coalesce(p_seed, 0)) + 1
    returning value into v_next;

  return v_next;
end $$;

revoke all on function public.reserve_receipt_sequence(uuid, bigint) from public;
grant execute on function public.reserve_receipt_sequence(uuid, bigint) to authenticated;;
