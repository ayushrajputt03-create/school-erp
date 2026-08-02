-- school-assets public bucket hai, par uspar ek broad SELECT policy bhi padi thi
-- (school_assets_public_read, roles = PUBLIC) jo kisi bhi anon client ko poora
-- bucket LIST karne deti thi — yaani har school ka logo/seal/signature path
-- enumerate ho jaata tha. Supabase advisor isi ko WARN karta hai
-- (0025_public_bucket_allows_listing).
--
-- Public bucket ko object URL serve karne ke liye ye policy chahiye hi nahi:
-- /storage/v1/object/public/... RLS ko bypass karta hai. Logo, seal aur
-- signature waise ke waise render hote rahenge — sirf listing band hoti hai.
--
-- Read ko apne school ke folder tak simit kar rahe hain, wahi shakal jo
-- student-photos par pehle se hai (student_photos_school_read).
drop policy if exists school_assets_public_read on storage.objects;

create policy school_assets_school_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'school-assets'
    and (storage.foldername(name))[1] = current_school_id()::text
  );
