-- ============================================================
-- SECURITY FIX (CRITICAL): app_users cross-tenant privilege escalation
--
-- Purani app_users_upd policy (migration 0012, 0010 se aayi
-- "app_users_claim_own_school" ka roop) me self-branch ka WITH CHECK sirf
-- `id = auth.uid()` tha — school_id ya role par koi rok nahi.
--
--   using      : (id = auth.uid() AND school_id IS NULL) OR (admin of own school)
--   with check : (id = auth.uid())                        OR (admin of own school)
--
-- Isse ye ho sakta tha:
--   1. Koi bhi naya banda register karta hai (registration khuli hai).
--      Trigger uski app_users row banata hai: school_id NULL, role 'owner'.
--   2. school_codes_read policy anon+authenticated ke liye `true` hai, aur
--      school_codes me school_id (uuid) padi hai — yaani kisi bhi school ka
--      uuid seedha padha ja sakta hai.
--   3. Ab wo chala de:
--        update app_users set school_id = '<kisi aur school ka uuid>'
--         where id = auth.uid();
--      USING (purani row): school_id IS NULL -> true.
--      WITH CHECK (nayi row): id = auth.uid() -> true.
--      Update lag jaata hai.
--   4. Ab current_school_id() us doosre school ko lautata hai aur role 'owner'
--      hone se is_school_admin() true — yaani us school ke saare students,
--      parents (bachchon ke phone/DOB), fees, sab kuch padhne-likhne ki chhoot.
--
-- Yaani ek ajnabi kisi bhi school ko hijack kar sakta tha. Bachchon ka data.
--
-- ------------------------------------------------------------
-- Fix: self-branch hata rahe hain. Ab app_users ko sirf apne school ka admin
-- hi badal sakta hai, aur wahi apne school ke andar (school_id dono taraf
-- current_school_id() se bandha hai, isliye kisi ko doosre school me nahi
-- bhej sakta).
--
-- Ye kisi live raaste ko nahi todta — poore repo (src/ + api/) me app_users
-- par ek bhi update/insert/upsert nahi hai; teeno maujooda school ki app_users
-- rows import script (service role) ne bhari thi, RLS ke bahar se. Login sirf
-- SELECT karta hai. Isliye self-write ki zarurat kisi ke paas hai hi nahi.
--
-- Aage jab live "naya school Supabase par register" wala flow judega, to
-- self-claim ke liye ek SECURITY DEFINER RPC (jaise claim_school(target))
-- banana — jo pehle jaanche ki wo school sach me isi user ne banaya hai —
-- na ki khuli RLS UPDATE. Khuli UPDATE hi ye chhed thi.
-- ============================================================

drop policy if exists app_users_upd on public.app_users;

create policy app_users_upd on public.app_users
  for update to authenticated
  using (
    school_id = (select public.current_school_id())
    and (select public.is_school_admin())
  )
  with check (
    school_id = (select public.current_school_id())
    and (select public.is_school_admin())
  );
