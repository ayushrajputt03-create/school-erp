-- ==========================================================
-- 1) SECURITY DEFINER function REST par khule pade the
--
-- Har public function /rest/v1/rpc/<naam> par apne aap mil jaata hai. Trigger
-- wale function (handle_new_auth_user, sync_attendance_summary) kisi ko bhi
-- bulane ki zaroorat nahi — trigger unhe khud chalata hai, EXECUTE grant se
-- uska koi lena-dena nahi. Aur bina login wale (anon) ko to kuch bhi nahi.
-- ==========================================================
revoke all on function public.handle_new_auth_user()    from public, anon, authenticated;
revoke all on function public.sync_attendance_summary() from public, anon, authenticated;

revoke all on function public.current_school_id()  from public, anon;
revoke all on function public.current_role_name()  from public, anon;
revoke all on function public.is_school_admin()    from public, anon;
revoke all on function public.can_see_class(text)  from public, anon;
revoke all on function public.my_visible_classes() from public, anon;
revoke all on function public.reserve_receipt_sequence(uuid, bigint) from public, anon;

-- RLS ko ye chahiye, isliye logged-in user ke paas rehne dena zaroori hai
grant execute on function public.current_school_id()  to authenticated;
grant execute on function public.current_role_name()  to authenticated;
grant execute on function public.is_school_admin()    to authenticated;
grant execute on function public.can_see_class(text)  to authenticated;
grant execute on function public.my_visible_classes() to authenticated;
grant execute on function public.reserve_receipt_sequence(uuid, bigint) to authenticated;

-- ==========================================================
-- 2) schools aur school_codes me koi bhi kuch bhi daal sakta tha
--
-- Dono policies `with check (true)` thi — yaani koi bhi logged-in user
-- (teacher bhi) jitni chaahe school rows bana sakta tha, aur kisi bhi school
-- code par kabza kar sakta tha.
--
-- Nayi shart: ya to aapka abhi koi school hai hi nahi (register ka pehla kadam),
-- ya aap admin ho. Register ka raasta isse rukta nahi — naye user ka
-- app_users.school_id shuru me null hi hota hai.
-- ==========================================================
drop policy if exists schools_insert_own on public.schools;
create policy schools_insert_own on public.schools for insert to authenticated
  with check (
    (select school_id from public.app_users where id = (select auth.uid())) is null
    or (select public.is_school_admin())
  );

drop policy if exists school_codes_insert on public.school_codes;
create policy school_codes_insert on public.school_codes for insert to authenticated
  with check (
    (select school_id from public.app_users where id = (select auth.uid())) is null
    or (school_id = (select public.current_school_id()) and (select public.is_school_admin()))
  );;
