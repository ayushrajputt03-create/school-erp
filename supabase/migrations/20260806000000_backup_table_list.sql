-- Backup script ko DB khud batata hai ki kaunsi tables hain.
--
-- Iske bina scripts/backup-all.mjs me ek hardcoded list rakhni padti, aur is
-- repo ki sabse aam galti wahi rahi hai: nayi cheez bani, purani list update
-- karna bhool gaye. Backup me wo galti sabse mehngi hoti — table chup-chaap
-- chhoot jaati aur pata tab chalta jab restore karna pade.
--
-- Sirf service_role ko, kyunki iska ek hi user hai: server-side backup script.
-- anon/authenticated ko schema ki list dena bekaar ka exposure hai.

create or replace function public.backup_table_list()
returns table (table_name text)
language sql
security definer
set search_path to 'public'
as $function$
  select c.relname::text
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname
$function$;

revoke all on function public.backup_table_list() from public, anon, authenticated;
grant execute on function public.backup_table_list() to service_role;
