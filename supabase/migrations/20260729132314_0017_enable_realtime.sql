-- Supabase me realtime apne aap chaalu nahi hota: table ko `supabase_realtime`
-- publication me daalna padta hai. Ab tak usme EK BHI table nahi thi, yaani
-- adapter ke saare listener sirf ek baar padh ke chup baith jaate the.
--
-- Asli asar: teacher attendance lagata, admin ki screen par kabhi nahi aati
-- jab tak page refresh na ho. Firebase me ye turant dikhta tha.
--
-- REPLICA IDENTITY FULL bhi zaroori hai. Bina iske DELETE ki khabar me sirf
-- primary key aati hai — usme school_id hota hi nahi, aur adapter ka filter
-- (school_id=eq.…) match nahi karta, to record mitane ki khabar gir jaati hai.
do $$
declare t text;
begin
  foreach t in array array[
    'students','attendance','fee_receipts','notices','staff','staff_attendance',
    'leave_requests','parents','admission_requests','certificates','homework',
    'report_marks','report_cards','exams','date_sheets',
    'parent_notifications','transport_allocations','fee_groups','fee_structures',
    'fee_fines','kv','schools'
  ] loop
    execute format('alter table public.%I replica identity full', t);
    if not exists (
      select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;;
