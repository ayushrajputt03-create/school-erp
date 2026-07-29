-- Teacher ki assigned classes ab app_users pe. Pehle sirf staff.assigned_classes
-- dekhi ja rahi thi, par kuch teachers ka staff record hai hi nahi
-- (wo schools/*/teachers me hain) — unhe kuch bhi nahi dikh raha tha.
alter table public.app_users add column if not exists assigned_classes text[];

comment on column public.app_users.assigned_classes is
  'Teacher jin classes ko dekh sakta hai. NULL = koi class nahi. owner/admin pe iska matlab nahi.';

create or replace function public.can_see_class(p_class text)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when public.is_school_admin() then true
    when p_class is null then false
    else exists (
      -- app_users pe seedhi lagi hui classes
      select 1 from public.app_users au
       where au.id = auth.uid()
         and au.assigned_classes is not null
         and trim(p_class) = any (select trim(x) from unnest(au.assigned_classes) x)
      union all
      -- ya staff record se (purana raasta, jahan wo maujood hai)
      select 1 from public.staff s
       where s.auth_user_id = auth.uid()
         and s.assigned_classes is not null
         and trim(p_class) = any (select trim(x) from unnest(string_to_array(s.assigned_classes, ',')) x)
    )
  end
$$;;
