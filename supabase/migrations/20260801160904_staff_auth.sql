-- ============================================================
-- Staff login ke liye auth.users ki row.
--
-- Firebase par staff login custom token se hota tha: server school code +
-- phone + DOB jaanchta tha aur apne aap ek token bana deta tha. Supabase me
-- custom token hai hi nahi — wahan session sirf GoTrue de sakta hai, aur
-- GoTrue ko har staff ka auth.users record chahiye.
--
-- Staff ke paas apna password kabhi nahi tha (DOB hi password hai, aur wo
-- school data me pada hai, GoTrue me nahi). Isliye yahan sirf khaata banta
-- hai — password ki jagah ek aisa hash jo kabhi verify nahi hoga. Session
-- generate_link (magic link) se milta hai, jise server DOB jaanchne ke BAAD
-- hi banata hai.
--
-- Email asli nahi hoti: {legacy_id}@{code}.staff.schoolerp.app. Asli email
-- jaan-boojh kar nahi li — staff table me ek hi gmail do logon par laga hua
-- hai, aur auth.users me email unique hai. legacy_id se banayi email hamesha
-- alag rehti hai.
-- ============================================================

create or replace function public.ensure_staff_auth_user(
  p_school       uuid,
  p_staff_legacy text,
  p_email        text,
  p_role         text,
  p_name         text
)
returns table (user_id uuid, user_email text)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  -- Wahi uuid jo transform.mjs / import-auth.mjs banate hain: md5('user|<uid>').
  -- Isse auth.uid() aur app_users.id hamesha ek rehte hain — inke alag hote hi
  -- RLS us user ko kuch nahi dikhati.
  v_id    uuid := md5('user|' || p_staff_legacy)::uuid;
  v_email text := lower(trim(p_email));
begin
  if p_school is null or coalesce(p_staff_legacy, '') = '' or v_email = '' then
    raise exception 'ensure_staff_auth_user: school, staff id aur email teeno chahiye';
  end if;

  -- Sirf usi ke liye jo sach me is school ka staff hai. Ye function neeche
  -- app_users ka role aur legacy_uid seedhe likh deta hai, isliye kisi bhi
  -- doosre id par chal jaana khatarnak hoga — owner ki row bhi badal sakti thi.
  if not exists (select 1 from public.staff s where s.school_id = p_school and s.legacy_id = p_staff_legacy) then
    raise exception 'ensure_staff_auth_user: % is school ka staff nahi hai', p_staff_legacy;
  end if;

  -- Ye khaali string wale token columns chhodne MAT. NULL rehne par GoTrue
  -- inhe Go ke `string` me padhta hai aur har sign-in 500 deta hai
  -- ("converting NULL to string is unsupported") — password sahi hone par bhi.
  -- Ek baar asli me ho chuka hai; migration 0011 usi ka ilaaj tha.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new,
    email_change_token_current, email_change,
    phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    -- Jaan-boojh kar toota hua bcrypt hash: password se login kabhi nahi hoga.
    -- (NULL nahi rakha — upar wali hi dikkat dobara aa jaati.)
    '$2a$10$staffhasnopasswordstaffhasnopasswordstaffhasnopassworda',
    now(), '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', coalesce(p_name, ''), 'staff_id', p_staff_legacy),
    now(), now(),
    '', '', '', '', '', '', '', ''
  )
  on conflict (id) do nothing;

  -- Iske bina GoTrue user ko email provider se nahi jodta aur magic link
  -- verify hone par bhi session nahi banta.
  insert into auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
  values (
    v_id::text, v_id,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
    'email', now(), now()
  )
  on conflict (provider, provider_id) do nothing;

  -- app_users ki row: yahi RLS ka aadhaar hai.
  --
  -- Yahan `on conflict do update` me legacy_uid, role aur school_id SEEDHE
  -- likhe jaate hain, coalesce se nahi. Wajah: upar wala auth.users insert
  -- migration 0010 ka on_auth_user_created trigger chala deta hai, jo naye
  -- signup maan kar pehle hi ek row bana deta hai — role 'owner' aur
  -- legacy_uid = uuid. Coalesce us galat row ko hi bacha leta tha, aur staff
  -- ko owner ke saare adhikaar mil jaate the (fees samet), sath hi har data
  -- path `schools/<uuid>/...` par chala jaata jo hai hi nahi.
  --
  -- legacy_uid staff ka purana id hi rehna chahiye — poore app me path wahi se
  -- bante hain. role staff record ke department se aata hai, wahi sach hai.
  insert into public.app_users (id, legacy_uid, school_id, role, email, full_name)
  values (v_id, p_staff_legacy, p_school, coalesce(p_role, 'staff'), v_email, nullif(coalesce(p_name, ''), ''))
  on conflict (id) do update set
    legacy_uid = excluded.legacy_uid,
    school_id  = excluded.school_id,
    role       = excluded.role,
    email      = coalesce(public.app_users.email, excluded.email),
    full_name  = coalesce(public.app_users.full_name, excluded.full_name);

  -- staff row se joda — my_visible_classes() teacher ki classes yahin se
  -- padhta hai (staff.assigned_classes, comma se alag).
  update public.staff s
     set auth_user_id = v_id
   where s.school_id = p_school
     and s.legacy_id = p_staff_legacy
     and s.auth_user_id is distinct from v_id;

  -- auth.users.email varchar(255) hai; bina cast ke Postgres
  -- "structure of query does not match function result type" deta hai.
  return query select v_id, (select u.email::text from auth.users u where u.id = v_id);
end
$fn$;

-- Sirf server. Browser ke paas ye function pahunch gaya to koi bhi apne liye
-- khaata bana lega.
revoke all on function public.ensure_staff_auth_user(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.ensure_staff_auth_user(uuid, text, text, text, text) to service_role;
;
