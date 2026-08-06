-- Runs once, when the data volume is first created.
--
-- `prisma migrate dev` diffs the schema against a throwaway "shadow" database
-- that it creates and drops on every run. The application user cannot create
-- databases by default, so it is granted rights over that name pattern only —
-- not globally.
GRANT ALL PRIVILEGES ON `prisma_migrate_shadow_db_%`.* TO 'bookcsi'@'%';
FLUSH PRIVILEGES;
