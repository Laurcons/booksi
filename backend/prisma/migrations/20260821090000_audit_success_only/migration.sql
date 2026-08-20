-- §D46 — the audit trail records only what people *did* (successes). Failed
-- operations are no longer written, so the `outcome` column (and its enum)
-- become dead — every remaining row is a success by construction.
--
-- Two steps: clear the failures already on record, then drop the column.
-- Order matters — the DELETE reads `outcome`, so it runs before the column
-- goes. Dropping the column drops the inline ENUM type with it (MySQL).

-- Step 1/2 — remove the failed operations the user does not want to see.
DELETE FROM `AuditLog` WHERE `outcome` = 'FAILURE';

-- Step 2/2 — drop the now-constant column.
ALTER TABLE `AuditLog` DROP COLUMN `outcome`;
