-- fee_receipts.student_id par constraint ON DELETE SET NULL tha. Matlab trash se
-- kisi student ko permanently delete karte hi uski saari receipts ka student_id
-- chup-chaap NULL ho jaata — paisa kiska tha, ye record se ud jaata, bina kisi
-- error ke, bina kisi nishaan ke.
--
-- Ye sirf theory nahi thi: 2026-07-25 ko production me ek row aise hi orphan
-- padi mili (receipt_1784861709015). Us row me amount 0 aur koi receipt number
-- nahi tha, isliye paisa nahi gaya — par raasta khula hua tha.
--
-- Ab RESTRICT hai: jis student ki koi bhi receipt hai (soft-deleted receipt bhi,
-- kyunki cancel ki hui receipt bhi hisaab ka record hai), use permanently delete
-- nahi kiya ja sakta. Soft delete (deleted_at) waise hi chalta rahega — trash me
-- daalna, restore karna, sab pehle jaisa. Sirf "permanently delete" rukta hai,
-- aur wo loudly rukta hai, chup-chaap data khone ki jagah.
--
-- Purani row ko chhua nahi ja raha. Constraint sirf aage ke deletes par lagti
-- hai, isliye maujooda data waisa ka waisa hai.

alter table public.fee_receipts
  drop constraint if exists fee_receipts_student_id_fkey;

alter table public.fee_receipts
  add constraint fee_receipts_student_id_fkey
  foreign key (student_id) references public.students(id)
  on delete restrict;
