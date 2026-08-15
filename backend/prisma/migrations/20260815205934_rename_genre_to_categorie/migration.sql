-- §D39 — the 17-value literary-genre enum becomes a 29-value topic-category
-- list. This is a value-set *replacement*, not an addition: `SCIFI` and
-- `FANTASY` (say) don't exist in the new list, so every existing row has to
-- land on a new value — or NULL — before MySQL will accept the new ENUM
-- definition. A straight ALTER to the new ENUM would silently blank out
-- (empty-string) any row whose old value isn't in the new set instead of
-- failing loudly, which is worse than either outcome this migration produces.
--
-- Three steps: widen the column to plain text so any string is legal,
-- rewrite every old code to its new home, then narrow back to the real ENUM
-- now that every stored value is one of its members.

-- Step 1/3: widen so the old values survive as plain strings while they're
-- rewritten below.
ALTER TABLE `Book` MODIFY COLUMN `genre` VARCHAR(191) NULL;

-- Step 2/3: the mapping. Chosen once here, not left for a human to eyeball
-- per row:
--   FICTION, SCIFI, FANTASY, THRILLER, ROMANCE -> FICTION (all fiction subgenres
--     collapse into the one fiction category the new list has)
--   HISTORICAL -> HISTORY
--   MEMOIR -> BIOGRAPHIES
--   SELF_HELP -> HEALTH_SELF_DEVELOPMENT
--   BUSINESS -> BUSINESS_ECONOMY
--   SCIENCE -> EXACT_SCIENCES_MATH
--   PHILOSOPHY, PSYCHOLOGY -> unchanged, both names carry over as-is
--   POETRY -> POETRY_THEATRE
--   COMICS_MANGA -> COMICS
--   NONFICTION, CHILDREN_YA, OTHER -> NULL (no category in the new list
--     covers what these meant; forcing a specific one would misclassify
--     rather than merely leave unset)
UPDATE `Book`
SET `genre` = CASE `genre`
  WHEN 'FICTION' THEN 'FICTION'
  WHEN 'SCIFI' THEN 'FICTION'
  WHEN 'FANTASY' THEN 'FICTION'
  WHEN 'THRILLER' THEN 'FICTION'
  WHEN 'ROMANCE' THEN 'FICTION'
  WHEN 'HISTORICAL' THEN 'HISTORY'
  WHEN 'MEMOIR' THEN 'BIOGRAPHIES'
  WHEN 'NONFICTION' THEN NULL
  WHEN 'SELF_HELP' THEN 'HEALTH_SELF_DEVELOPMENT'
  WHEN 'BUSINESS' THEN 'BUSINESS_ECONOMY'
  WHEN 'SCIENCE' THEN 'EXACT_SCIENCES_MATH'
  WHEN 'PHILOSOPHY' THEN 'PHILOSOPHY'
  WHEN 'PSYCHOLOGY' THEN 'PSYCHOLOGY'
  WHEN 'POETRY' THEN 'POETRY_THEATRE'
  WHEN 'COMICS_MANGA' THEN 'COMICS'
  WHEN 'CHILDREN_YA' THEN NULL
  WHEN 'OTHER' THEN NULL
  ELSE `genre`
END
WHERE `genre` IS NOT NULL;

-- Step 3/3: narrow to the real ENUM. Every stored value is now one of these
-- 29 members (or NULL), so nothing here can be truncated to ''.
ALTER TABLE `Book` MODIFY COLUMN `genre` ENUM('AUDIOBOOKS', 'CULINARY', 'ART_ARCHITECTURE', 'ENCYCLOPEDIAS', 'BIOGRAPHIES', 'LINGUISTICS_DICTIONARIES', 'ROMANIAN_MAGAZINES', 'FOREIGN_LANGUAGES', 'POETRY_THEATRE', 'FICTION', 'COMICS', 'TRAVEL_GUIDES', 'HISTORY', 'RELIGION', 'PHILOSOPHY', 'PSYCHOLOGY', 'SOCIAL_SCIENCES_POLITICS', 'MARKETING_COMMUNICATION', 'BUSINESS_ECONOMY', 'LAW', 'MEDICINE', 'EXACT_SCIENCES_MATH', 'NATURE_ENVIRONMENT', 'TECHNOLOGY', 'COMPUTERS_INTERNET', 'HEALTH_SELF_DEVELOPMENT', 'LIFESTYLE_SPORT_LEISURE', 'ROMANIA', 'EDUCATIONAL_SOFTWARE') NULL;
