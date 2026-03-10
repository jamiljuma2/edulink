-- One-time remap script for user-id linkage issues.
-- Run this in Neon SQL editor after replacing placeholders.

begin;

-- 1) Replace these values before running.
-- old_uid: wrong user id currently attached to records.
-- new_uid: correct Firebase UID for the student account.
-- Example:
--   old_uid = 'legacy-user-id'
--   new_uid = 'cBHV0peZatOxAPEfFt8ENl49CRu2'

-- 2) Move assignment ownership.
update public.assignments
set student_id = 'NEW_UID'
where student_id = 'OLD_UID';

-- 3) Move wallet and transactions ownership.
update public.wallets
set user_id = 'NEW_UID'
where user_id = 'OLD_UID';

update public.transactions
set user_id = 'NEW_UID'
where user_id = 'OLD_UID';

-- 4) Move related activity logs.
update public.registration_logs
set user_id = 'NEW_UID'
where user_id = 'OLD_UID';

-- 5) Verify linkage after remap.
-- Replace NEW_UID with the same value used above.
--
-- select count(*) as assignment_count
-- from public.assignments
-- where student_id = 'NEW_UID';
--
-- select *
-- from public.wallets
-- where user_id = 'NEW_UID';

commit;
