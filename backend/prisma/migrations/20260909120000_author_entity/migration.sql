-- §D51 — the author becomes an entity.
--
-- The same three-step sequence §D39 and §D45 used, and for the same reason:
-- widen, carry the old data across, then drop. Nothing is discarded, and the
-- database is queryable between any two statements.
--
--   1. create `Author` and add the nullable `Book.authorId`
--   2. one `Author` per distinct name the reader already had, then point
--      every book at its own
--   3. drop `Book.author`
--
-- Step 2 is the interesting one. `SELECT DISTINCT` over a `utf8mb4_unicode_ci`
-- column already folds case *and* accents, so "Frank Herbert" / "frank herbert"
-- and "Călinescu" / "Calinescu" each collapse to a single author — which is the
-- intent (the new unique index folds exactly the same way), but it leaves the
-- question of *which spelling to keep*. MariaDB would answer that arbitrarily.
-- The window function below answers it deliberately: the spelling that appears
-- on the most books wins, ties broken by byte order so the result is the same
-- on every run.

-- CreateTable
CREATE TABLE `Author` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `biography` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Author_userId_name_key`(`userId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddColumn
ALTER TABLE `Book` ADD COLUMN `authorId` VARCHAR(191) NULL;

-- Backfill: one author per distinct (folded) name the reader already had.
--
-- The id is cuid-*shaped* rather than a real cuid — 'c' plus 24 hex characters
-- of `RANDOM_BYTES`, evaluated per row. Ids are opaque everywhere in this app,
-- and the alternative (a `UUID()` in a column full of cuids) would be a shape
-- that stands out in every debugging session for no benefit.
INSERT INTO `Author` (`id`, `userId`, `name`, `biography`, `createdAt`, `updatedAt`)
SELECT
    CONCAT('c', LOWER(HEX(RANDOM_BYTES(12)))),
    picked.`userId`,
    picked.`name`,
    -- The column this came from held a name and nothing else, so every author
    -- the migration creates starts without a biography. That is also what the
    -- book form's empty state is written for.
    NULL,
    NOW(3),
    NOW(3)
FROM (
    SELECT
        b.`userId` AS `userId`,
        b.`author` AS `name`,
        -- PARTITION BY uses the column's collation, so every spelling of one
        -- name shares a partition; GROUP BY adds the binary form, so each row
        -- entering the window is one exact spelling with its own count.
        ROW_NUMBER() OVER (
            PARTITION BY b.`userId`, b.`author`
            ORDER BY COUNT(*) DESC, CAST(b.`author` AS BINARY) ASC
        ) AS `rn`
    FROM `Book` b
    WHERE b.`author` IS NOT NULL AND TRIM(b.`author`) <> ''
    GROUP BY b.`userId`, b.`author`, CAST(b.`author` AS BINARY)
) picked
WHERE picked.`rn` = 1;

-- Point every book at its author. The join is collated, so a book spelled
-- "frank herbert" finds the "Frank Herbert" row the step above kept.
UPDATE `Book` b
JOIN `Author` a ON a.`userId` = b.`userId` AND a.`name` = b.`author`
SET b.`authorId` = a.`id`
WHERE b.`author` IS NOT NULL AND TRIM(b.`author`) <> '';

-- DropColumn: the old data is across, so the column goes. A book whose author
-- was NULL or whitespace keeps a NULL `authorId` and loses nothing.
ALTER TABLE `Book` DROP COLUMN `author`;

-- CreateIndex
CREATE INDEX `Book_authorId_idx` ON `Book`(`authorId`);

-- AddForeignKey: SetNull, so deleting an author leaves its books standing
-- without one. See the schema comment on `Book.authorId`.
ALTER TABLE `Author` ADD CONSTRAINT `Author_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `Book` ADD CONSTRAINT `Book_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `Author`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
