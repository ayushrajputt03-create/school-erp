-- students par 8 index the, do ka ek bhi scan nahi hua.
--
-- pg_stat_user_indexes (poore DB ke jeevan bhar ka, saare test runs samet):
--   students_admission_idx     0 scans, 104 kB  <- sabse bada index table par
--   students_school_class_idx  0 scans,  40 kB
--
-- Dono non-unique hain, to inhe girane se koi constraint nahi jaata — sirf
-- lookup ka raasta jaata hai, aur wo raasta koi le hi nahi raha tha.
--
-- students_school_class_idx (school_id, class_name) waise bhi zaroorat se
-- zyada tha: students_class_idx (school_id, class_name, section)
-- WHERE deleted_at is null active students ko cover karta hai, aur delete
-- kiye hue students students_school_deleted_idx se milte hain.
--
-- students_admission_idx (school_id, admission_number) admission number se
-- khoj ke liye tha. Agar aage aisi koi screen aaye aur dheemi lage, ye ek
-- line me wapas aa jaata hai:
--   create index students_admission_idx on public.students (school_id, admission_number);
--
-- Index girana data ke liye surakshit hai — row ek bhi nahi chhooti, aur
-- wapas banana kabhi bhi ho sakta hai.

drop index if exists public.students_admission_idx;
drop index if exists public.students_school_class_idx;
