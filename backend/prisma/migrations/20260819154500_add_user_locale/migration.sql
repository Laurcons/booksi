-- §D44 — the interface speaks Romanian and English, and an account remembers
-- which one it reads.
--
-- DEFAULT 'ro' is deliberately not the application's default locale, which is
-- 'en'. Every row that exists when this runs belongs to a Romanian reader, so
-- the column has to preserve what those accounts already see; 'en' is the
-- answer for a request with nobody behind it, which is a different question.
ALTER TABLE `User` ADD COLUMN `locale` VARCHAR(191) NOT NULL DEFAULT 'ro';
