-- Migration: Standalone one-time bulk auto-link for existing unlinked students
-- Matches student contact numbers with parents.phone within the same school.
-- Date: 2026-08-12

do $$
begin
  -- Update student parent_id by matching last 10 digits of father_phone / parent_login_phone / guardian_phone to parent phone
  update public.students s
  set parent_id = p.id
  from public.parents p
  where s.parent_id is null
    and s.school_id = p.school_id
    and (
      right(regexp_replace(coalesce(s.father_phone, s.parent_login_phone, s.guardian_phone, ''), '\D', 'g', 'g'), 10) = right(regexp_replace(p.phone, '\D', 'g', 'g'), 10)
    )
    and right(regexp_replace(p.phone, '\D', 'g', 'g'), 10) <> '';
end $$;
