-- §D45 — the single-value `Genre` enum (§D39) becomes a two-level category
-- taxonomy held in three tables, and a book gains the ability to sit on several
-- shelves at once (reversing §D17). Generated from
-- backend/prisma/categories.data.ts — edit there and regenerate, do not hand-edit.
--
-- Order matters: create the tables, seed the controlled vocabulary, backfill
-- each existing book onto the general leaf of its old group (the old value only
-- ever named a group — see LEGACY_GENRE_MAP), then drop the old column. The
-- backfill runs before the drop so the old value is still there to map from.

-- Step 1/5 — the taxonomy tables.
CREATE TABLE `CategoryGroup` (
    `code` VARCHAR(191) NOT NULL,
    `labelRo` VARCHAR(191) NOT NULL,
    `labelEn` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `Category` (
    `code` VARCHAR(191) NOT NULL,
    `groupCode` VARCHAR(191) NOT NULL,
    `labelRo` VARCHAR(191) NOT NULL,
    `labelEn` VARCHAR(191) NOT NULL,
    `sortOrder` INTEGER NOT NULL,
    INDEX `Category_groupCode_idx`(`groupCode`),
    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `BookCategory` (
    `bookId` VARCHAR(191) NOT NULL,
    `categoryCode` VARCHAR(191) NOT NULL,
    INDEX `BookCategory_categoryCode_idx`(`categoryCode`),
    PRIMARY KEY (`bookId`, `categoryCode`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Category` ADD CONSTRAINT `Category_groupCode_fkey` FOREIGN KEY (`groupCode`) REFERENCES `CategoryGroup`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `BookCategory` ADD CONSTRAINT `BookCategory_bookId_fkey` FOREIGN KEY (`bookId`) REFERENCES `Book`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `BookCategory` ADD CONSTRAINT `BookCategory_categoryCode_fkey` FOREIGN KEY (`categoryCode`) REFERENCES `Category`(`code`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Step 2/5 — seed the group headings, in display order.
INSERT INTO `CategoryGroup` (`code`, `labelRo`, `labelEn`, `sortOrder`) VALUES
  ('ART_ARCHITECTURE', 'Artă, arhitectură', 'Art & architecture', 0),
  ('LINGUISTICS_DICTIONARIES', 'Lingvistică, dicționare', 'Linguistics & dictionaries', 1),
  ('ROMANIAN_MAGAZINES', 'Reviste - Limba română', 'Magazines — Romanian', 2),
  ('FOREIGN_LANGUAGES', 'Limbi străine', 'Foreign languages', 3),
  ('POETRY_THEATRE', 'Poezie, teatru, studii literare', 'Poetry, theatre & literary studies', 4),
  ('FICTION', 'Ficțiune', 'Fiction', 5),
  ('COMICS', 'Benzi desenate', 'Comics & graphic novels', 6),
  ('TRAVEL_GUIDES', 'Ghiduri și hărți turistice, atlase', 'Travel guides, maps & atlases', 7),
  ('HISTORY', 'Istorie', 'History', 8),
  ('RELIGION', 'Religie', 'Religion', 9),
  ('PHILOSOPHY', 'Filosofie', 'Philosophy', 10),
  ('PSYCHOLOGY', 'Psihologie', 'Psychology', 11),
  ('SOCIAL_SCIENCES_POLITICS', 'Științe sociale. Politică', 'Social sciences & politics', 12),
  ('MARKETING_COMMUNICATION', 'Marketing și comunicare', 'Marketing & communication', 13),
  ('BUSINESS_ECONOMY', 'Business și economie', 'Business & economics', 14),
  ('LAW', 'Drept', 'Law', 15),
  ('MEDICINE', 'Medicină', 'Medicine', 16),
  ('EXACT_SCIENCES_MATH', 'Științe exacte. Matematici', 'Exact sciences & mathematics', 17),
  ('NATURE_ENVIRONMENT', 'Natură și mediu', 'Nature & environment', 18),
  ('TECHNOLOGY', 'Tehnică și tehnologie', 'Engineering & technology', 19),
  ('COMPUTERS_INTERNET', 'Computere și internet', 'Computers & internet', 20),
  ('HEALTH_SELF_DEVELOPMENT', 'Sănătate, dezvoltare personală', 'Health & personal development', 21),
  ('LIFESTYLE_SPORT_LEISURE', 'Lifestyle, sport, timp liber', 'Lifestyle, sport & leisure', 22),
  ('EDUCATIONAL_SOFTWARE', 'Soft educațional', 'Educational software', 23),
  ('MANGA', 'Manga', 'Manga', 24),
  ('ALTELE', 'Altele', 'Other', 25);

-- Step 3/5 — seed the shelves under each heading, in display order.
INSERT INTO `Category` (`code`, `groupCode`, `labelRo`, `labelEn`, `sortOrder`) VALUES
  ('ART_ARCHITECTURE__GENERAL', 'ART_ARCHITECTURE', 'Generalități', 'General', 0),
  ('ART_ARCHITECTURE__ART_THEORY', 'ART_ARCHITECTURE', 'Teoria artei', 'Art theory', 1),
  ('ART_ARCHITECTURE__DRAWING', 'ART_ARCHITECTURE', 'Tehnici de desen', 'Drawing technique', 2),
  ('ART_ARCHITECTURE__ART_HISTORY', 'ART_ARCHITECTURE', 'Istoria artei', 'Art history', 3),
  ('ART_ARCHITECTURE__PAINTING', 'ART_ARCHITECTURE', 'Pictură, grafică, alte forme artistice', 'Painting, graphics & other art forms', 4),
  ('ART_ARCHITECTURE__PHOTOGRAPHY', 'ART_ARCHITECTURE', 'Fotografie', 'Photography', 5),
  ('ART_ARCHITECTURE__COMMERCIAL', 'ART_ARCHITECTURE', 'Artă comercială și industrială', 'Commercial & industrial art', 6),
  ('ART_ARCHITECTURE__INTERIOR', 'ART_ARCHITECTURE', 'Design interior', 'Interior design', 7),
  ('ART_ARCHITECTURE__ARCHITECTURE', 'ART_ARCHITECTURE', 'Arhitectură', 'Architecture', 8),
  ('ART_ARCHITECTURE__THEATRE', 'ART_ARCHITECTURE', 'Teatru', 'Theatre', 9),
  ('ART_ARCHITECTURE__FILM_TV', 'ART_ARCHITECTURE', 'Film, TV, radio', 'Film, TV & radio', 10),
  ('ART_ARCHITECTURE__DANCE', 'ART_ARCHITECTURE', 'Dans, performing arts', 'Dance & performing arts', 11),
  ('ART_ARCHITECTURE__MUSIC', 'ART_ARCHITECTURE', 'Muzică', 'Music', 12),
  ('LINGUISTICS_DICTIONARIES__GENERAL', 'LINGUISTICS_DICTIONARIES', 'Generalități', 'General', 0),
  ('LINGUISTICS_DICTIONARIES__DICTIONARIES', 'LINGUISTICS_DICTIONARIES', 'Dicționare', 'Dictionaries', 1),
  ('LINGUISTICS_DICTIONARIES__GRAMMAR', 'LINGUISTICS_DICTIONARIES', 'Gramatică', 'Grammar', 2),
  ('LINGUISTICS_DICTIONARIES__CREATIVE_WRITING', 'LINGUISTICS_DICTIONARIES', 'Creative writing', 'Creative writing', 3),
  ('LINGUISTICS_DICTIONARIES__HISTORY_OF_LANGUAGE', 'LINGUISTICS_DICTIONARIES', 'Istoria limbajului', 'History of language', 4),
  ('LINGUISTICS_DICTIONARIES__LINGUISTICS', 'LINGUISTICS_DICTIONARIES', 'Lingvistică', 'Linguistics', 5),
  ('ROMANIAN_MAGAZINES__ARHITEXT', 'ROMANIAN_MAGAZINES', 'Arhitext design', 'Arhitext design', 0),
  ('ROMANIAN_MAGAZINES__CSF', 'ROMANIAN_MAGAZINES', 'CSF', 'CSF', 1),
  ('ROMANIAN_MAGAZINES__DECAT_O_REVISTA', 'ROMANIAN_MAGAZINES', 'Decât o Revistă', 'Decât o Revistă', 2),
  ('ROMANIAN_MAGAZINES__SECOLUL_21', 'ROMANIAN_MAGAZINES', 'Fundația Culturală Secolul 21', 'Fundația Culturală Secolul 21', 3),
  ('ROMANIAN_MAGAZINES__IGLOO', 'ROMANIAN_MAGAZINES', 'Igloo', 'Igloo', 4),
  ('ROMANIAN_MAGAZINES__IOCAN', 'ROMANIAN_MAGAZINES', 'Iocan', 'Iocan', 5),
  ('ROMANIAN_MAGAZINES__LETTRE', 'ROMANIAN_MAGAZINES', 'Lettre Internationale', 'Lettre Internationale', 6),
  ('ROMANIAN_MAGAZINES__REVISTA_ARTA', 'ROMANIAN_MAGAZINES', 'Revista Arta', 'Revista Arta', 7),
  ('ROMANIAN_MAGAZINES__REVISTA_FILM', 'ROMANIAN_MAGAZINES', 'Revista Film', 'Revista Film', 8),
  ('ROMANIAN_MAGAZINES__COMUNICARE', 'ROMANIAN_MAGAZINES', 'Revista română de comunicare și relații publice', 'Revista română de comunicare și relații publice', 9),
  ('ROMANIAN_MAGAZINES__SCENA9', 'ROMANIAN_MAGAZINES', 'Scena9', 'Scena9', 10),
  ('ROMANIAN_MAGAZINES__TODAY_SOFTWARE', 'ROMANIAN_MAGAZINES', 'Today Software', 'Today Software', 11),
  ('ROMANIAN_MAGAZINES__ZEPPELIN', 'ROMANIAN_MAGAZINES', 'Zeppelin', 'Zeppelin', 12),
  ('ROMANIAN_MAGAZINES__OTHER', 'ROMANIAN_MAGAZINES', 'Alte reviste', 'Other magazines', 13),
  ('FOREIGN_LANGUAGES__GENERAL', 'FOREIGN_LANGUAGES', 'Generalități', 'General', 0),
  ('FOREIGN_LANGUAGES__LEARNING', 'FOREIGN_LANGUAGES', 'Învățarea limbilor străine', 'Language learning', 1),
  ('FOREIGN_LANGUAGES__DICTIONARIES', 'FOREIGN_LANGUAGES', 'Dicționare', 'Dictionaries', 2),
  ('POETRY_THEATRE__GENERAL', 'POETRY_THEATRE', 'Generalități', 'General', 0),
  ('POETRY_THEATRE__POETRY', 'POETRY_THEATRE', 'Poezie', 'Poetry', 1),
  ('POETRY_THEATRE__PLAYS', 'POETRY_THEATRE', 'Piese de teatru, scenarii', 'Plays & screenplays', 2),
  ('POETRY_THEATRE__ESSAYS', 'POETRY_THEATRE', 'Eseistică', 'Essays', 3),
  ('POETRY_THEATRE__ANTHOLOGIES', 'POETRY_THEATRE', 'Antologii', 'Anthologies', 4),
  ('POETRY_THEATRE__CRITICISM', 'POETRY_THEATRE', 'Istorie și critică', 'Literary history & criticism', 5),
  ('FICTION__GENERAL', 'FICTION', 'Generalități', 'General', 0),
  ('FICTION__CLASSICS', 'FICTION', 'Clasici', 'Classics', 1),
  ('FICTION__MODERN', 'FICTION', 'Moderni, contemporani', 'Modern & contemporary', 2),
  ('FICTION__CRIME', 'FICTION', 'Crime, mister', 'Crime & mystery', 3),
  ('FICTION__THRILLER', 'FICTION', 'Thriller, horror', 'Thriller & horror', 4),
  ('FICTION__YOUNG_ADULT', 'FICTION', 'Young adult', 'Young adult', 5),
  ('FICTION__ADVENTURE', 'FICTION', 'Aventură', 'Adventure', 6),
  ('FICTION__SF', 'FICTION', 'SF', 'Science fiction', 7),
  ('FICTION__FANTASY', 'FICTION', 'Fantasy', 'Fantasy', 8),
  ('FICTION__EROTIC', 'FICTION', 'Ficțiune erotică', 'Erotic fiction', 9),
  ('FICTION__MYTH_HISTORICAL', 'FICTION', 'Ficțiune mitologică și istorică', 'Mythological & historical fiction', 10),
  ('FICTION__ROMANCE', 'FICTION', 'Romance', 'Romance', 11),
  ('FICTION__SHORT_STORIES', 'FICTION', 'Proză scurtă, altele', 'Short stories & other', 12),
  ('COMICS__GENERAL', 'COMICS', 'Generalități', 'General', 0),
  ('COMICS__GRAPHIC_NOVELS', 'COMICS', 'Romane ilustrate', 'Graphic novels', 1),
  ('COMICS__COMICS', 'COMICS', 'Comics', 'Comics', 2),
  ('TRAVEL_GUIDES__GENERAL', 'TRAVEL_GUIDES', 'Generalități', 'General', 0),
  ('TRAVEL_GUIDES__ATLASES', 'TRAVEL_GUIDES', 'Atlase, hărți, referințe geografice', 'Atlases, maps & geographic reference', 1),
  ('TRAVEL_GUIDES__TOURISM', 'TRAVEL_GUIDES', 'Turism și călătorii', 'Tourism & travel', 2),
  ('HISTORY__GENERAL', 'HISTORY', 'Istorie generală', 'General history', 0),
  ('HISTORY__ARCHAEOLOGY', 'HISTORY', 'Arheologie', 'Archaeology', 1),
  ('HISTORY__EUROPE', 'HISTORY', 'Istoria Europei', 'History of Europe', 2),
  ('HISTORY__ROMANIANS', 'HISTORY', 'Istoria românilor', 'History of the Romanians', 3),
  ('HISTORY__MILITARY', 'HISTORY', 'Istorie militară, apărare', 'Military history & defence', 4),
  ('HISTORY__MUSEOLOGY', 'HISTORY', 'Muzeologie', 'Museology', 5),
  ('HISTORY__INTERNATIONAL_RELATIONS', 'HISTORY', 'Relații internaționale', 'International relations', 6),
  ('HISTORY__WORLD', 'HISTORY', 'Istorie universală', 'World history', 7),
  ('HISTORY__ECONOMIC', 'HISTORY', 'Istorie economică', 'Economic history', 8),
  ('HISTORY__MENTALITIES', 'HISTORY', 'Istoria mentalităților', 'History of mentalities', 9),
  ('HISTORY__SECRET', 'HISTORY', 'Istorii secrete', 'Secret histories', 10),
  ('RELIGION__GENERAL', 'RELIGION', 'Generalități, istoria religiilor', 'General & history of religions', 0),
  ('RELIGION__CHRISTIANITY', 'RELIGION', 'Creștinism', 'Christianity', 1),
  ('RELIGION__BUDDHISM', 'RELIGION', 'Buddhism', 'Buddhism', 2),
  ('RELIGION__HINDUISM', 'RELIGION', 'Hinduism', 'Hinduism', 3),
  ('RELIGION__ISLAM', 'RELIGION', 'Islam', 'Islam', 4),
  ('RELIGION__JUDAISM', 'RELIGION', 'Iudaism', 'Judaism', 5),
  ('RELIGION__OTHER', 'RELIGION', 'Alte religii și credințe', 'Other religions & beliefs', 6),
  ('RELIGION__OCCULT', 'RELIGION', 'Ocultism și ezoterism', 'Occultism & esotericism', 7),
  ('PHILOSOPHY__GENERAL', 'PHILOSOPHY', 'Generalități', 'General', 0),
  ('PHILOSOPHY__WESTERN_HISTORY', 'PHILOSOPHY', 'Istoria filosofiei occidentale', 'History of Western philosophy', 1),
  ('PHILOSOPHY__METAPHYSICS', 'PHILOSOPHY', 'Metafizică și ontologie', 'Metaphysics & ontology', 2),
  ('PHILOSOPHY__EPISTEMOLOGY', 'PHILOSOPHY', 'Epistemologie, teoria cunoașterii', 'Epistemology & theory of knowledge', 3),
  ('PHILOSOPHY__LOGIC', 'PHILOSOPHY', 'Logică', 'Logic', 4),
  ('PHILOSOPHY__MIND', 'PHILOSOPHY', 'Filosofia minții', 'Philosophy of mind', 5),
  ('PHILOSOPHY__LANGUAGE', 'PHILOSOPHY', 'Filosofia limbajului', 'Philosophy of language', 6),
  ('PHILOSOPHY__AESTHETICS', 'PHILOSOPHY', 'Estetică', 'Aesthetics', 7),
  ('PHILOSOPHY__SEMIOTICS', 'PHILOSOPHY', 'Semiotică', 'Semiotics', 8),
  ('PHILOSOPHY__ETHICS', 'PHILOSOPHY', 'Etică și morală', 'Ethics & morality', 9),
  ('PHILOSOPHY__SCIENCE', 'PHILOSOPHY', 'Filosofia științei', 'Philosophy of science', 10),
  ('PHILOSOPHY__SOCIAL_POLITICAL', 'PHILOSOPHY', 'Filosofie social-politică', 'Social & political philosophy', 11),
  ('PHILOSOPHY__NON_WESTERN', 'PHILOSOPHY', 'Filosofie non-occidentală', 'Non-Western philosophy', 12),
  ('PHILOSOPHY__POPULAR', 'PHILOSOPHY', 'Filosofie populară', 'Popular philosophy', 13),
  ('PSYCHOLOGY__GENERAL', 'PSYCHOLOGY', 'Teorie generală, școli', 'General theory & schools', 0),
  ('PSYCHOLOGY__METHODOLOGY', 'PSYCHOLOGY', 'Metodologie, testare', 'Methodology & testing', 1),
  ('PSYCHOLOGY__CHILD', 'PSYCHOLOGY', 'Psihologia copilului și dezvoltării', 'Child & developmental psychology', 2),
  ('PSYCHOLOGY__PSYCHOTHERAPY', 'PSYCHOLOGY', 'Psihoterapie', 'Psychotherapy', 3),
  ('PSYCHOLOGY__AGE_GENDER', 'PSYCHOLOGY', 'Psihologia vârstelor și a sexelor', 'Psychology of age & gender', 4),
  ('PSYCHOLOGY__FAMILY', 'PSYCHOLOGY', 'Psihologia familiei', 'Family psychology', 5),
  ('PSYCHOLOGY__SOCIAL', 'PSYCHOLOGY', 'Psihologia socială și de grup', 'Social & group psychology', 6),
  ('PSYCHOLOGY__OCCUPATIONAL', 'PSYCHOLOGY', 'Psihologia ocupațională', 'Occupational psychology', 7),
  ('PSYCHOLOGY__FORENSIC', 'PSYCHOLOGY', 'Psihologia criminalistică și legală', 'Forensic & legal psychology', 8),
  ('PSYCHOLOGY__NEURO', 'PSYCHOLOGY', 'Neuropsihologie, biopsihologie', 'Neuropsychology & biopsychology', 9),
  ('PSYCHOLOGY__EMOTIONS', 'PSYCHOLOGY', 'Psihologia emoțiilor', 'Psychology of emotions', 10),
  ('PSYCHOLOGY__COGNITIVE', 'PSYCHOLOGY', 'Psihologia cognitivă', 'Cognitive psychology', 11),
  ('PSYCHOLOGY__IDENTITY', 'PSYCHOLOGY', 'Eu, ego, identitate, personalitate', 'Self, ego, identity & personality', 12),
  ('SOCIAL_SCIENCES_POLITICS__GENERAL', 'SOCIAL_SCIENCES_POLITICS', 'Generalități', 'General', 0),
  ('SOCIAL_SCIENCES_POLITICS__CULTURAL', 'SOCIAL_SCIENCES_POLITICS', 'Studii culturale', 'Cultural studies', 1),
  ('SOCIAL_SCIENCES_POLITICS__INTERDISCIPLINARY', 'SOCIAL_SCIENCES_POLITICS', 'Studii interdisciplinare', 'Interdisciplinary studies', 2),
  ('SOCIAL_SCIENCES_POLITICS__SOCIOLOGY', 'SOCIAL_SCIENCES_POLITICS', 'Sociologie, antropologie', 'Sociology & anthropology', 3),
  ('SOCIAL_SCIENCES_POLITICS__CRIMINOLOGY', 'SOCIAL_SCIENCES_POLITICS', 'Criminologie', 'Criminology', 4),
  ('SOCIAL_SCIENCES_POLITICS__EDUCATION', 'SOCIAL_SCIENCES_POLITICS', 'Educație', 'Education', 5),
  ('SOCIAL_SCIENCES_POLITICS__GOVERNANCE', 'SOCIAL_SCIENCES_POLITICS', 'Politologie și guvernare', 'Political science & governance', 6),
  ('SOCIAL_SCIENCES_POLITICS__INTERNATIONAL_RELATIONS', 'SOCIAL_SCIENCES_POLITICS', 'Relații internaționale', 'International relations', 7),
  ('SOCIAL_SCIENCES_POLITICS__PARTIES', 'SOCIAL_SCIENCES_POLITICS', 'Doctrine și partide politice', 'Political doctrines & parties', 8),
  ('SOCIAL_SCIENCES_POLITICS__DEFENCE', 'SOCIAL_SCIENCES_POLITICS', 'Apărare națională', 'National defence', 9),
  ('SOCIAL_SCIENCES_POLITICS__JOURNALISM', 'SOCIAL_SCIENCES_POLITICS', 'Publicistică și jurnalism', 'Journalism', 10),
  ('MARKETING_COMMUNICATION__GENERAL', 'MARKETING_COMMUNICATION', 'Generalități', 'General', 0),
  ('MARKETING_COMMUNICATION__ADVERTISING', 'MARKETING_COMMUNICATION', 'Publicitate și media', 'Advertising & media', 1),
  ('MARKETING_COMMUNICATION__PR', 'MARKETING_COMMUNICATION', 'Relații publice', 'Public relations', 2),
  ('MARKETING_COMMUNICATION__INDUSTRY', 'MARKETING_COMMUNICATION', 'Industria comunicării', 'Communication industry', 3),
  ('BUSINESS_ECONOMY__GENERAL', 'BUSINESS_ECONOMY', 'Generalități', 'General', 0),
  ('BUSINESS_ECONOMY__ECONOMICS', 'BUSINESS_ECONOMY', 'Economie', 'Economics', 1),
  ('BUSINESS_ECONOMY__STRATEGY', 'BUSINESS_ECONOMY', 'Strategie', 'Strategy', 2),
  ('BUSINESS_ECONOMY__FINANCE', 'BUSINESS_ECONOMY', 'Finanțe și contabilitate', 'Finance & accounting', 3),
  ('BUSINESS_ECONOMY__BUSINESS', 'BUSINESS_ECONOMY', 'Business', 'Business', 4),
  ('BUSINESS_ECONOMY__ENTREPRENEURSHIP', 'BUSINESS_ECONOMY', 'Antreprenoriat', 'Entrepreneurship', 5),
  ('BUSINESS_ECONOMY__MANAGEMENT', 'BUSINESS_ECONOMY', 'Tehnici de management', 'Management technique', 6),
  ('BUSINESS_ECONOMY__SALES', 'BUSINESS_ECONOMY', 'Marketing și vânzări', 'Marketing & sales', 7),
  ('LAW__GENERAL', 'LAW', 'Teorie generală, jurisprudență', 'General theory & jurisprudence', 0),
  ('LAW__INTERNATIONAL', 'LAW', 'Drept internațional', 'International law', 1),
  ('LAW__CIVIL', 'LAW', 'Drept civil', 'Civil law', 2),
  ('LAW__COMMERCIAL', 'LAW', 'Drept comercial', 'Commercial law', 3),
  ('LAW__CONSTITUTIONAL', 'LAW', 'Drept constituțional', 'Constitutional law', 4),
  ('LAW__CRIMINAL', 'LAW', 'Drept penal', 'Criminal law', 5),
  ('LAW__LABOUR', 'LAW', 'Legislația muncii', 'Labour law', 6),
  ('LAW__ENVIRONMENT_TRANSPORT', 'LAW', 'Dreptul mediului, transport', 'Environmental & transport law', 7),
  ('LAW__FAMILY', 'LAW', 'Dreptul familiei', 'Family law', 8),
  ('LAW__FINANCIAL', 'LAW', 'Drept financiar', 'Financial law', 9),
  ('LAW__INTELLECTUAL_PROPERTY', 'LAW', 'Proprietate intelectuală', 'Intellectual property', 10),
  ('LAW__SOCIAL', 'LAW', 'Drept social', 'Social law', 11),
  ('MEDICINE__GENERAL', 'MEDICINE', 'Aspecte generale', 'General aspects', 0),
  ('MEDICINE__PRECLINICAL', 'MEDICINE', 'Preclinic: anatomie, fiziologie', 'Preclinical: anatomy & physiology', 1),
  ('MEDICINE__CLINICAL', 'MEDICINE', 'Medicină clinică și internă', 'Clinical & internal medicine', 2),
  ('MEDICINE__DENTISTRY', 'MEDICINE', 'Stomatologie', 'Dentistry', 3),
  ('MEDICINE__PHARMACOLOGY', 'MEDICINE', 'Farmacologie', 'Pharmacology', 4),
  ('MEDICINE__PSYCHIATRY', 'MEDICINE', 'Psihiatrie, psihologie clinică, terapii', 'Psychiatry, clinical psychology & therapies', 5),
  ('MEDICINE__SPORTS', 'MEDICINE', 'Medicină sportivă', 'Sports medicine', 6),
  ('MEDICINE__OTHER_FORMS', 'MEDICINE', 'Alte forme de medicină', 'Other forms of medicine', 7),
  ('MEDICINE__SURGERY', 'MEDICINE', 'Chirurgie', 'Surgery', 8),
  ('MEDICINE__NURSING', 'MEDICINE', 'Îngrijire și asistență', 'Nursing & care', 9),
  ('MEDICINE__REFERENCE', 'MEDICINE', 'Ghiduri și referințe', 'Guides & reference', 10),
  ('MEDICINE__COMPLEMENTARY', 'MEDICINE', 'Medicină complementară', 'Complementary medicine', 11),
  ('MEDICINE__VETERINARY', 'MEDICINE', 'Medicină veterinară', 'Veterinary medicine', 12),
  ('EXACT_SCIENCES_MATH__GENERAL', 'EXACT_SCIENCES_MATH', 'Generalități', 'General', 0),
  ('EXACT_SCIENCES_MATH__MATH', 'EXACT_SCIENCES_MATH', 'Matematică', 'Mathematics', 1),
  ('EXACT_SCIENCES_MATH__HISTORY_OF_SCIENCE', 'EXACT_SCIENCES_MATH', 'Istoria științei și generalități', 'History of science', 2),
  ('EXACT_SCIENCES_MATH__ASTRONOMY', 'EXACT_SCIENCES_MATH', 'Astronomie, spațiu, timp', 'Astronomy, space & time', 3),
  ('EXACT_SCIENCES_MATH__PHYSICS', 'EXACT_SCIENCES_MATH', 'Fizică', 'Physics', 4),
  ('EXACT_SCIENCES_MATH__CHEMISTRY', 'EXACT_SCIENCES_MATH', 'Chimie', 'Chemistry', 5),
  ('EXACT_SCIENCES_MATH__BIOLOGY', 'EXACT_SCIENCES_MATH', 'Biologie', 'Biology', 6),
  ('NATURE_ENVIRONMENT__GENERAL', 'NATURE_ENVIRONMENT', 'Generalități', 'General', 0),
  ('NATURE_ENVIRONMENT__EARTH_SCIENCES', 'NATURE_ENVIRONMENT', 'Științele Pământului', 'Earth sciences', 1),
  ('NATURE_ENVIRONMENT__GEOGRAPHY', 'NATURE_ENVIRONMENT', 'Geografie', 'Geography', 2),
  ('NATURE_ENVIRONMENT__ECOLOGY', 'NATURE_ENVIRONMENT', 'Mediu și ecologie', 'Environment & ecology', 3),
  ('TECHNOLOGY__GENERAL', 'TECHNOLOGY', 'Tehnologie: generalități', 'Technology: general', 0),
  ('TECHNOLOGY__MECHANICS', 'TECHNOLOGY', 'Mecanică și știința materialelor', 'Mechanics & materials science', 1),
  ('TECHNOLOGY__ELECTRONICS', 'TECHNOLOGY', 'Electronică și comunicații', 'Electronics & communications', 2),
  ('TECHNOLOGY__CONSTRUCTION', 'TECHNOLOGY', 'Construcții', 'Construction', 3),
  ('TECHNOLOGY__OTHER', 'TECHNOLOGY', 'Alte tehnologii', 'Other technologies', 4),
  ('TECHNOLOGY__AGRICULTURE', 'TECHNOLOGY', 'Agricultură', 'Agriculture', 5),
  ('COMPUTERS_INTERNET__GENERAL', 'COMPUTERS_INTERNET', 'Generalități', 'General', 0),
  ('COMPUTERS_INTERNET__DIGITAL_LIFESTYLE', 'COMPUTERS_INTERNET', 'Lifestyle digital', 'Digital lifestyle', 1),
  ('COMPUTERS_INTERNET__PROGRAMMING', 'COMPUTERS_INTERNET', 'Programare, dezvoltare', 'Programming & development', 2),
  ('COMPUTERS_INTERNET__NETWORKS', 'COMPUTERS_INTERNET', 'Rețele și comunicații', 'Networks & communications', 3),
  ('COMPUTERS_INTERNET__AI', 'COMPUTERS_INTERNET', 'Inteligență artificială', 'Artificial intelligence', 4),
  ('HEALTH_SELF_DEVELOPMENT__GENERAL', 'HEALTH_SELF_DEVELOPMENT', 'Generalități', 'General', 0),
  ('HEALTH_SELF_DEVELOPMENT__FITNESS', 'HEALTH_SELF_DEVELOPMENT', 'Fitness și dietă', 'Fitness & diet', 1),
  ('HEALTH_SELF_DEVELOPMENT__PARENTING', 'HEALTH_SELF_DEVELOPMENT', 'Parenting', 'Parenting', 2),
  ('HEALTH_SELF_DEVELOPMENT__NATURAL_MEDICINE', 'HEALTH_SELF_DEVELOPMENT', 'Medicină naturistă, îngrijire', 'Natural medicine & care', 3),
  ('HEALTH_SELF_DEVELOPMENT__FAMILY_HEALTH', 'HEALTH_SELF_DEVELOPMENT', 'Familie, sănătate', 'Family & health', 4),
  ('HEALTH_SELF_DEVELOPMENT__SELF_DEVELOPMENT', 'HEALTH_SELF_DEVELOPMENT', 'Dezvoltare personală', 'Personal development', 5),
  ('HEALTH_SELF_DEVELOPMENT__PARANORMAL', 'HEALTH_SELF_DEVELOPMENT', 'Fenomene paranormale', 'Paranormal phenomena', 6),
  ('HEALTH_SELF_DEVELOPMENT__DREAMS', 'HEALTH_SELF_DEVELOPMENT', 'Interpretarea viselor', 'Dream interpretation', 7),
  ('HEALTH_SELF_DEVELOPMENT__COMPLEMENTARY', 'HEALTH_SELF_DEVELOPMENT', 'Terapii complementare', 'Complementary therapies', 8),
  ('HEALTH_SELF_DEVELOPMENT__ASTROLOGY', 'HEALTH_SELF_DEVELOPMENT', 'Astrologie', 'Astrology', 9),
  ('HEALTH_SELF_DEVELOPMENT__NUMEROLOGY', 'HEALTH_SELF_DEVELOPMENT', 'Numerologie', 'Numerology', 10),
  ('HEALTH_SELF_DEVELOPMENT__DIVINATION', 'HEALTH_SELF_DEVELOPMENT', 'Cartomanție, alte preziceri', 'Cartomancy & other divination', 11),
  ('HEALTH_SELF_DEVELOPMENT__MIND_BODY_SPIRIT', 'HEALTH_SELF_DEVELOPMENT', 'Minte, corp, spirit', 'Mind, body & spirit', 12),
  ('LIFESTYLE_SPORT_LEISURE__GENERAL', 'LIFESTYLE_SPORT_LEISURE', 'Generalități', 'General', 0),
  ('LIFESTYLE_SPORT_LEISURE__COLOURING', 'LIFESTYLE_SPORT_LEISURE', 'Cărți de colorat pentru adulți', 'Adult colouring books', 1),
  ('LIFESTYLE_SPORT_LEISURE__ANTIQUES', 'LIFESTYLE_SPORT_LEISURE', 'Antichități, colecții', 'Antiques & collections', 2),
  ('LIFESTYLE_SPORT_LEISURE__HOBBIES', 'LIFESTYLE_SPORT_LEISURE', 'Hobby, jocuri', 'Hobbies & games', 3),
  ('LIFESTYLE_SPORT_LEISURE__DECORATIVE', 'LIFESTYLE_SPORT_LEISURE', 'Obiecte decorative', 'Decorative objects', 4),
  ('LIFESTYLE_SPORT_LEISURE__SAILING', 'LIFESTYLE_SPORT_LEISURE', 'Navigație', 'Sailing', 5),
  ('LIFESTYLE_SPORT_LEISURE__AUTO', 'LIFESTYLE_SPORT_LEISURE', 'Auto, transport, deplasare', 'Cars, transport & travel', 6),
  ('LIFESTYLE_SPORT_LEISURE__HUMOUR', 'LIFESTYLE_SPORT_LEISURE', 'Umor', 'Humour', 7),
  ('LIFESTYLE_SPORT_LEISURE__FASHION', 'LIFESTYLE_SPORT_LEISURE', 'Lifestyle, fashion', 'Lifestyle & fashion', 8),
  ('LIFESTYLE_SPORT_LEISURE__HOME_GARDEN', 'LIFESTYLE_SPORT_LEISURE', 'Casă, grădină, familie', 'Home, garden & family', 9),
  ('LIFESTYLE_SPORT_LEISURE__NATURE_ANIMALS', 'LIFESTYLE_SPORT_LEISURE', 'Lumea naturii, animale', 'The natural world & animals', 10),
  ('LIFESTYLE_SPORT_LEISURE__SPORT', 'LIFESTYLE_SPORT_LEISURE', 'Sport și recreere', 'Sport & recreation', 11),
  ('LIFESTYLE_SPORT_LEISURE__TRAVEL', 'LIFESTYLE_SPORT_LEISURE', 'Călătorii', 'Travel', 12),
  ('EDUCATIONAL_SOFTWARE__GENERAL', 'EDUCATIONAL_SOFTWARE', 'Generalități', 'General', 0),
  ('EDUCATIONAL_SOFTWARE__PRIMARY', 'EDUCATIONAL_SOFTWARE', 'Primar', 'Primary', 1),
  ('EDUCATIONAL_SOFTWARE__MIDDLE', 'EDUCATIONAL_SOFTWARE', 'Gimnazial', 'Middle school', 2),
  ('EDUCATIONAL_SOFTWARE__HIGH', 'EDUCATIONAL_SOFTWARE', 'Liceal', 'High school', 3),
  ('EDUCATIONAL_SOFTWARE__PACKAGES', 'EDUCATIONAL_SOFTWARE', 'Pachete educaționale', 'Educational packages', 4),
  ('MANGA__MYSTERY', 'MANGA', 'Mystery', 'Mystery', 0),
  ('MANGA__SEINEN', 'MANGA', 'Seinen', 'Seinen', 1),
  ('MANGA__SHONEN', 'MANGA', 'Shonen', 'Shonen', 2),
  ('MANGA__COMEDY', 'MANGA', 'Comedy', 'Comedy', 3),
  ('MANGA__SHOJO', 'MANGA', 'Shojo', 'Shojo', 4),
  ('MANGA__JOSEI', 'MANGA', 'Josei', 'Josei', 5),
  ('MANGA__DRAMA', 'MANGA', 'Drama', 'Drama', 6),
  ('MANGA__ACTION_ADVENTURE', 'MANGA', 'Action & Adventure', 'Action & Adventure', 7),
  ('MANGA__FANTASY', 'MANGA', 'Fantasy', 'Fantasy', 8),
  ('MANGA__HORROR', 'MANGA', 'Horror', 'Horror', 9),
  ('MANGA__ISEKAI', 'MANGA', 'Isekai', 'Isekai', 10),
  ('MANGA__LGBTQ', 'MANGA', 'LGBTQ', 'LGBTQ', 11),
  ('MANGA__MADE_INTO_ANIME', 'MANGA', 'Made into Anime', 'Made into Anime', 12),
  ('MANGA__TIE_IN', 'MANGA', 'Movie, TV Tie-in', 'Movie, TV Tie-in', 13),
  ('MANGA__ROMANCE', 'MANGA', 'Romance', 'Romance', 14),
  ('MANGA__SCHOOL_LIFE', 'MANGA', 'School Life', 'School Life', 15),
  ('MANGA__SCIENCE_FICTION', 'MANGA', 'Science Fiction', 'Science Fiction', 16),
  ('MANGA__SLICE_OF_LIFE', 'MANGA', 'Slice of Life', 'Slice of Life', 17),
  ('MANGA__SPORTS', 'MANGA', 'Sports', 'Sports', 18),
  ('MANGA__THRILLER', 'MANGA', 'Thriller', 'Thriller', 19),
  ('MANGA__VIDEO_GAME_TIE_IN', 'MANGA', 'Video Game Tie-in', 'Video Game Tie-in', 20),
  ('MANGA__YAOI_BL', 'MANGA', 'Yaoi, BL', 'Yaoi, BL', 21),
  ('MANGA__YURI', 'MANGA', 'Yuri', 'Yuri', 22),
  ('MANGA__LIGHT_NOVEL', 'MANGA', 'Light Novel', 'Light Novel', 23),
  ('MANGA__HISTORICAL', 'MANGA', 'Historical', 'Historical', 24),
  ('ALTELE__AUDIOBOOKS', 'ALTELE', 'Audiobooks', 'Audiobooks', 0),
  ('ALTELE__CULINARE', 'ALTELE', 'Culinare', 'Cooking', 1),
  ('ALTELE__ENCICLOPEDII', 'ALTELE', 'Enciclopedii', 'Encyclopedias', 2),
  ('ALTELE__BIOGRAFII', 'ALTELE', 'Biografii, memorii, jurnale', 'Biography, memoir & diaries', 3),
  ('ALTELE__ROMANIA', 'ALTELE', 'România', 'Romania', 4);

-- Step 4/5 — move every existing book onto the general leaf of its old group.
-- The old `genre` was a single group-level value; each maps to that group's
-- `general` shelf (LEGACY_GENRE_MAP). NULL genres carry over as no category.
INSERT INTO `BookCategory` (`bookId`, `categoryCode`)
SELECT `id`, CASE `genre`
    WHEN 'AUDIOBOOKS' THEN 'ALTELE__AUDIOBOOKS'
    WHEN 'CULINARY' THEN 'ALTELE__CULINARE'
    WHEN 'ENCYCLOPEDIAS' THEN 'ALTELE__ENCICLOPEDII'
    WHEN 'BIOGRAPHIES' THEN 'ALTELE__BIOGRAFII'
    WHEN 'ROMANIA' THEN 'ALTELE__ROMANIA'
    WHEN 'ART_ARCHITECTURE' THEN 'ART_ARCHITECTURE__GENERAL'
    WHEN 'LINGUISTICS_DICTIONARIES' THEN 'LINGUISTICS_DICTIONARIES__GENERAL'
    WHEN 'ROMANIAN_MAGAZINES' THEN 'ROMANIAN_MAGAZINES__OTHER'
    WHEN 'FOREIGN_LANGUAGES' THEN 'FOREIGN_LANGUAGES__GENERAL'
    WHEN 'POETRY_THEATRE' THEN 'POETRY_THEATRE__GENERAL'
    WHEN 'FICTION' THEN 'FICTION__GENERAL'
    WHEN 'COMICS' THEN 'COMICS__GENERAL'
    WHEN 'TRAVEL_GUIDES' THEN 'TRAVEL_GUIDES__GENERAL'
    WHEN 'HISTORY' THEN 'HISTORY__GENERAL'
    WHEN 'RELIGION' THEN 'RELIGION__GENERAL'
    WHEN 'PHILOSOPHY' THEN 'PHILOSOPHY__GENERAL'
    WHEN 'PSYCHOLOGY' THEN 'PSYCHOLOGY__GENERAL'
    WHEN 'SOCIAL_SCIENCES_POLITICS' THEN 'SOCIAL_SCIENCES_POLITICS__GENERAL'
    WHEN 'MARKETING_COMMUNICATION' THEN 'MARKETING_COMMUNICATION__GENERAL'
    WHEN 'BUSINESS_ECONOMY' THEN 'BUSINESS_ECONOMY__GENERAL'
    WHEN 'LAW' THEN 'LAW__GENERAL'
    WHEN 'MEDICINE' THEN 'MEDICINE__GENERAL'
    WHEN 'EXACT_SCIENCES_MATH' THEN 'EXACT_SCIENCES_MATH__GENERAL'
    WHEN 'NATURE_ENVIRONMENT' THEN 'NATURE_ENVIRONMENT__GENERAL'
    WHEN 'TECHNOLOGY' THEN 'TECHNOLOGY__GENERAL'
    WHEN 'COMPUTERS_INTERNET' THEN 'COMPUTERS_INTERNET__GENERAL'
    WHEN 'HEALTH_SELF_DEVELOPMENT' THEN 'HEALTH_SELF_DEVELOPMENT__GENERAL'
    WHEN 'LIFESTYLE_SPORT_LEISURE' THEN 'LIFESTYLE_SPORT_LEISURE__GENERAL'
    WHEN 'EDUCATIONAL_SOFTWARE' THEN 'EDUCATIONAL_SOFTWARE__GENERAL'
  END
FROM `Book`
WHERE `genre` IS NOT NULL;

-- Step 5/5 — drop the old single-value column (and, with it, the `Genre` enum).
ALTER TABLE `Book` DROP COLUMN `genre`;
