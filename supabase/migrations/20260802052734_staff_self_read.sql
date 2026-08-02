-- ============================================================
-- Teacher ko doosre staff ka record nahi dikhna chahiye.
--
-- staff_read abhi tak poore school ka staff kisi bhi logged-in user ko de
-- deta tha. public.staff ke source me `phone` aur `dob` dono pade hain — aur
-- staff login hai hi school code + phone + DOB. Yaani ek teacher ka khaata
-- mil jaye to us school ke HAR staff ka khaata mil jaata hai, Admin aur
-- Accountant samet. Salary bhi usi record me hai.
--
-- Ye hole pehle se tha, par abhi tak Supabase par staff login band tha to
-- pahunch hi nahi thi. Migration 0021 ne login chalu kiya hai, isliye iske
-- saath hi ye band karna zaroori hai.
--
-- Admin/owner ko poori list chahiye (EmployeeManager), isliye wo waise ki
-- waisi. Teacher/staff ko sirf apni row — TeacherApp bhi sirf
-- `schools/{id}/staff/{uid}` hi padhta hai, poori list kabhi nahi.
--
-- my_visible_classes() aur can_see_class() SECURITY DEFINER hain, unpar RLS
-- lagti hi nahi — class scoping is badlaav se nahi tootegi.
-- ============================================================

drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff
  for select to authenticated
  using (
    school_id = (select public.current_school_id())
    and ((select public.is_school_admin()) or auth_user_id = (select auth.uid()))
  );
;
