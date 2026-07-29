-- ============================================================
-- 0019_super_admin.sql — owner console ko Supabase par laata hai
--
-- Dikkat ye thi: RLS har cheez ko `current_school_id()` tak seemit rakhti hai,
-- aur ayushrajputt03@gmail.com khud bhi ek school (Northstar) ka owner hai.
-- Matlab owner console usse sirf EK school dikhata — teeno nahi.
--
-- Aasan raasta ye hota ki har table ki RLS me "ya super admin ho" jod diya jaye.
-- Wo nahi kiya: usse har table par ek aur shart lag jaati (padhne ki laagat
-- wapas badh jaati, jo 0012-0014 me ghatayi thi) aur console ko poore database
-- ki chaabi mil jaati, jabki use sirf profile + subscription + ginti chahiye.
--
-- Iske badle do SECURITY DEFINER function hain jo bilkul utna hi lautate/badalte
-- hain jitna console ko chahiye. Baaki har table ki RLS jaisi thi waisi hai.
-- ============================================================

-- ------------------------------------------------------------
-- kaun super admin hai
-- ------------------------------------------------------------
create table if not exists public.super_admins (
  email         text primary key,
  name          text,
  phone         text,
  legacy_uid    text,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz,
  source        jsonb not null default '{}'::jsonb
);

alter table public.super_admins enable row level security;
-- Jaanbujh kar ek bhi policy nahi. RLS on + zero policy = anon/authenticated ke
-- liye table poori tarah band. Sirf neeche wale SECURITY DEFINER function ise
-- chhoo sakte hain, to koi apne aap ko super admin bana nahi sakta.

insert into public.super_admins (email, name)
values ('ayushrajputt03@gmail.com', 'NXT Owner')
on conflict (email) do nothing;

-- JWT claim padhne ke bajaye auth.users se email milaya jaata hai — claim ka
-- roop badal jaye to bhi ye nahi tootega.
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from auth.users u
      join public.super_admins sa on lower(sa.email) = lower(u.email)
     where u.id = auth.uid()
  )
$$;

-- ------------------------------------------------------------
-- console ka poora data — ek hi call me
--
-- Pehle ye 1 + 3x7 = 22 alag request thi (har school ke liye profile,
-- subscription, payments, createdAt aur teen shallow ginti). Ab ek.
-- ------------------------------------------------------------
create or replace function public.super_admin_schools()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  out_json jsonb;
begin
  if not public.is_super_admin() then
    raise exception 'Owner console sirf super admin ke liye hai';
  end if;

  select coalesce(jsonb_object_agg(s.legacy_id, entry), '{}'::jsonb)
    into out_json
  from public.schools s
  -- Ye dono join lateral se PEHLE hone zaroori hain — lateral apne baad wale
  -- FROM items ko dekh hi nahi sakta.
  left join public.subscriptions sub on sub.school_id = s.id
  left join public.kv pay on pay.school_id = s.id and pay.path = 'payments'
  cross join lateral (
    select jsonb_build_object(
      'profile', coalesce(s.source, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
        'schoolName',  s.name,
        'schoolCode',  s.code,
        'logoURL',     s.logo_url,
        'principalName', s.principal_name,
        'email',       s.email,
        'phone',       s.phone,
        'city',        s.city,
        'address',     s.address
      )),
      'subscription', coalesce(sub.source, '{}'::jsonb),
      'payments',     coalesce(pay.value, '{}'::jsonb),
      'createdAt',    (extract(epoch from s.created_at) * 1000)::bigint,
      -- RTDB ke ?shallow=true jaisa hi {id: true} — UI inhe Object.keys(...).length
      -- se ginta hai, isliye shape wahi rakha hai
      'students', coalesce((
        select jsonb_object_agg(st.legacy_id, true) from public.students st
         where st.school_id = s.id and st.deleted_at is null and st.legacy_id is not null
      ), '{}'::jsonb),
      'staff', coalesce((
        select jsonb_object_agg(f.legacy_id, true) from public.staff f
         where f.school_id = s.id and f.legacy_id is not null
      ), '{}'::jsonb),
      'teachers', coalesce((
        select jsonb_object_agg(au.legacy_uid, true) from public.app_users au
         where au.school_id = s.id and au.role = 'teacher' and au.legacy_uid is not null
      ), '{}'::jsonb)
    ) as entry
  ) e;

  return out_json;
end $$;

-- ------------------------------------------------------------
-- login par owner ka apna record
-- ------------------------------------------------------------
create or replace function public.super_admin_touch_login(p_legacy_uid text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  v_row   public.super_admins%rowtype;
begin
  if not public.is_super_admin() then
    raise exception 'Owner console sirf super admin ke liye hai';
  end if;

  select lower(u.email) into v_email from auth.users u where u.id = auth.uid();

  update public.super_admins
     set last_login_at = now(),
         legacy_uid    = coalesce(p_legacy_uid, legacy_uid),
         name          = coalesce(nullif(p_name, ''), name)
   where lower(email) = v_email
  returning * into v_row;

  return jsonb_build_object(
    'uid',         v_row.legacy_uid,
    'name',        v_row.name,
    'email',       v_row.email,
    'phone',       coalesce(v_row.phone, ''),
    'role',        'super-admin',
    'createdAt',   (extract(epoch from v_row.created_at) * 1000)::bigint,
    'lastLoginAt', (extract(epoch from v_row.last_login_at) * 1000)::bigint
  );
end $$;

-- ------------------------------------------------------------
-- gehra set, raaste me object bante hue
--
-- jsonb_set(doc, '{pricingHistory,H1}', v, true) ka create_missing SIRF aakhri
-- key banata hai — beech ka `pricingHistory` na ho to poora set chup-chaap gir
-- jaata hai. Console har pricing change par yahi path likhta hai, aur jis school
-- me abhi tak koi history nahi thi uski entry kabhi save hi na hoti.
-- ------------------------------------------------------------
create or replace function public.jsonb_deep_set(doc jsonb, path text[], val jsonb)
returns jsonb language plpgsql immutable set search_path = public as $$
declare
  head text;
  base jsonb := coalesce(doc, '{}'::jsonb);
begin
  if coalesce(cardinality(path), 0) = 0 then
    return val;
  end if;

  head := path[1];

  if cardinality(path) = 1 then
    return base || jsonb_build_object(head, val);
  end if;

  return base || jsonb_build_object(
    head,
    public.jsonb_deep_set(
      case when jsonb_typeof(base -> head) = 'object' then base -> head else '{}'::jsonb end,
      path[2:],
      val
    )
  );
end $$;

-- ------------------------------------------------------------
-- console ke saare likhaav
--
-- Console RTDB ke multi-path andaz me likhta hai — har key poora path hoti hai:
--   { "schools/<id>/subscription/pricingType": "free",
--     "schools/<id>/profile/city": "Ghaziabad",
--     "schools/<id>/payments/PAY123": { ... } }
--
-- Wahi shape yahan bhi chalta hai, to SuperAdminApp ka patchRoot lagbhag jaisa
-- tha waisa hi rehta hai. Farq itna hai ki RTDB ke ulat ye SAB kuch ek hi
-- transaction me karta hai — beech me fail hua to kuch nahi lagta.
-- ------------------------------------------------------------
create or replace function public.super_admin_patch(p_changes jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  k        text;
  v        jsonb;
  parts    text[];
  section  text;
  rest     text[];
  sid      uuid;
  doc      jsonb;
  applied  int := 0;
begin
  if not public.is_super_admin() then
    raise exception 'Owner console sirf super admin ke liye hai';
  end if;

  for k, v in select key, value from jsonb_each(coalesce(p_changes, '{}'::jsonb)) loop
    parts := string_to_array(k, '/');

    if parts[1] <> 'schools' or coalesce(array_length(parts, 1), 0) < 3 then
      raise exception 'Ye path owner console se nahi badla ja sakta: %', k;
    end if;

    section := parts[3];
    rest    := parts[4:];

    select id into sid from public.schools where legacy_id = parts[2];
    if sid is null then
      raise exception 'School nahi mila: %', parts[2];
    end if;

    if section = 'name' then
      update public.schools
         set name   = v #>> '{}',
             source = coalesce(source, '{}'::jsonb) || jsonb_build_object('schoolName', v)
       where id = sid;

    elsif section = 'profile' then
      select coalesce(source, '{}'::jsonb) into doc from public.schools where id = sid;
      doc := case when cardinality(rest) = 0 then doc || v
                  else public.jsonb_deep_set(doc, rest, v) end;
      update public.schools set
        source          = doc,
        name            = coalesce(doc ->> 'schoolName', doc ->> 'name', name),
        principal_name  = coalesce(doc ->> 'principalName', principal_name),
        email           = coalesce(doc ->> 'email', doc ->> 'schoolEmail', email),
        phone           = coalesce(doc ->> 'phone', doc ->> 'schoolContactNo', phone),
        city            = coalesce(doc ->> 'city', city),
        address         = coalesce(doc ->> 'address', address)
      where id = sid;

    elsif section = 'subscription' then
      -- Sirf 2 me se 3 school ke paas subscription row hai — jiske paas nahi,
      -- uske liye bana do, warna pehla pricing change chup-chaap gir jaata.
      insert into public.subscriptions (school_id, source)
           values (sid, '{}'::jsonb)
      on conflict (school_id) do nothing;

      select coalesce(source, '{}'::jsonb) into doc from public.subscriptions where school_id = sid;
      doc := case when cardinality(rest) = 0 then doc || v
                  else public.jsonb_deep_set(doc, rest, v) end;
      update public.subscriptions set
        source     = doc,
        plan       = coalesce(doc ->> 'plan', plan),
        status     = coalesce(doc ->> 'status', status),
        amount     = coalesce((doc ->> 'amount')::numeric, amount),
        updated_at = now()
      where school_id = sid;

    elsif section = 'payments' then
      insert into public.kv (school_id, path, value)
           values (sid, 'payments', '{}'::jsonb)
      on conflict (school_id, path) do nothing;

      update public.kv
         set value = case when cardinality(rest) = 0 then v
                          else public.jsonb_deep_set(value, rest, v) end,
             updated_at = now()
       where school_id = sid and path = 'payments';

    else
      raise exception 'Owner console is hisse ko nahi badal sakta: %', section;
    end if;

    applied := applied + 1;
  end loop;

  return jsonb_build_object('applied', applied);
end $$;

-- ------------------------------------------------------------
-- 0018 wali hi baat: anon ke paas in RPC ka rasta nahi hona chahiye
-- ------------------------------------------------------------
revoke all on function public.is_super_admin()                    from public, anon;
revoke all on function public.super_admin_schools()               from public, anon;
revoke all on function public.super_admin_touch_login(text, text) from public, anon;
revoke all on function public.super_admin_patch(jsonb)            from public, anon;

grant execute on function public.is_super_admin()                    to authenticated;
grant execute on function public.super_admin_schools()               to authenticated;
grant execute on function public.super_admin_touch_login(text, text) to authenticated;
grant execute on function public.super_admin_patch(jsonb)            to authenticated;
;
