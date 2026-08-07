-- S4.4 was cut: the column recorded which fields a user had edited by hand, to
-- protect them from a later refresh of the Open Library data. There is no
-- refresh anywhere in the backlog, so the column was written on every edit and
-- read by nothing.
-- AlterTable
ALTER TABLE `Book` DROP COLUMN `manuallyEditedFields`;

-- S4.3: the cover is served with `Cache-Control: immutable`, and an upload can
-- replace it. `?v=<updatedAt>` is what makes the replacement a URL the browser
-- has never cached.
-- AlterTable
ALTER TABLE `Cover` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;
