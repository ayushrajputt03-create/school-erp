-- GoTrue in columns ko Go ke `string` me padhta hai, `*string` me nahi.
-- Insert karte waqt inhe chhod dena NULL chhod deta hai, aur phir har login par
-- GoTrue 500 deta hai:
--   "error finding user: sql: Scan error on column index 3,
--    name confirmation_token: converting NULL to string is unsupported"
--
-- Password bilkul theek tha — user ko sirf "kuch galat hai" dikhta, aur wajah
-- kahin nahi dikhti. Khaali string hi sahi "koi token nahi" hai.
update auth.users set
  confirmation_token         = coalesce(confirmation_token, ''),
  recovery_token             = coalesce(recovery_token, ''),
  email_change_token_new     = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  email_change               = coalesce(email_change, ''),
  phone_change               = coalesce(phone_change, ''),
  phone_change_token         = coalesce(phone_change_token, ''),
  reauthentication_token     = coalesce(reauthentication_token, '')
where confirmation_token is null
   or recovery_token is null
   or email_change_token_new is null
   or email_change_token_current is null
   or email_change is null
   or phone_change is null
   or phone_change_token is null
   or reauthentication_token is null;;
