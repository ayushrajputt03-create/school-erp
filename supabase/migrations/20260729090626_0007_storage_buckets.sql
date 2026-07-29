-- ============================================================
-- Do bucket:
--   school-assets  : logo, seal, signature — public.
--                    Ye certificates/ID cards pe chhapte hi hain, chhupane layak nahi.
--   student-photos : bachchon ki photos — PRIVATE.
--                    Path ka pehla folder school ka uuid hai, aur RLS wahi
--                    check karti hai. Doosre school ka koi bhi photo nahi khol sakta.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('school-assets',  'school-assets',  true,  5242880, array['image/png','image/jpeg','image/webp','image/svg+xml']),
  ('student-photos', 'student-photos', false, 5242880, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

-- ---------- school-assets ----------

create policy school_assets_public_read on storage.objects
  for select to public
  using (bucket_id = 'school-assets');

create policy school_assets_admin_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'school-assets'
    and public.is_school_admin()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

create policy school_assets_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'school-assets'
    and public.is_school_admin()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

create policy school_assets_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'school-assets'
    and public.is_school_admin()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

-- ---------- student-photos: sirf apne school ka ----------

create policy student_photos_school_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'student-photos'
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

create policy student_photos_admin_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'student-photos'
    and public.is_school_admin()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

create policy student_photos_admin_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'student-photos'
    and public.is_school_admin()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );

create policy student_photos_admin_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'student-photos'
    and public.is_school_admin()
    and (storage.foldername(name))[1] = public.current_school_id()::text
  );;
