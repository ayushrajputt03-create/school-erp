-- ============================================================
-- Naya school register kare to kya ho.
--
-- Dikkat: app_users ki row bina current_school_id() null rehta hai, aur
-- RLS user ko apni hi row banane nahi deti (is_school_admin() bhi usi row
-- se aata hai). Yaani naya user login to ho jaata hai par usse kuch dikhta
-- hi nahi — anda-murgi wali samasya.
--
-- Hal: auth.users me row bante hi app_users ki row apne aap ban jaye.
-- ============================================================

create or replace function public.handle_new_auth_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Pehle se ho (migration se aaya purana user) to haath mat lagao
  if exists (select 1 from public.app_users where id = new.id) then
    return new;
  end if;

  insert into public.app_users (id, legacy_uid, role, email, full_name)
  values (
    new.id,
    new.id::text,                       -- naye schools ke liye yahi schoolId banega
    'owner',
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

-- Naya user pehli baar apna school banata hai: us waqt uski app_users row me
-- school_id abhi null hai, isliye "apne school ka admin" wali policy laagu hi
-- nahi hoti. Ek baar khud ko school se jodne ki ijaazat chahiye.
create policy app_users_claim_own_school on public.app_users
  for update to authenticated
  using (id = auth.uid() and school_id is null)
  with check (id = auth.uid());

-- Aur school banane ki bhi — koi bhi logged-in user apna pehla school bana sake.
create policy schools_insert_own on public.schools
  for insert to authenticated
  with check (true);

-- school_codes bhi register ke waqt likhni padti hai
create policy school_codes_insert on public.school_codes
  for insert to authenticated
  with check (true);;
