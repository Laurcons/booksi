/**
 * §D45 — the category taxonomy, as data.
 *
 * This is the *source of truth* the seed migration was generated from, kept in
 * the repo for provenance and so a future change to the shelving scheme is an
 * edit here plus a regenerated migration rather than hand-written SQL. It is
 * NOT imported at runtime: the live taxonomy lives in the `CategoryGroup` /
 * `Category` tables (see docs/DECISIONS.md §D45 for why the labels left the
 * type system for the database).
 *
 * Structure: a two-level tree. **Groups are never selectable** — they exist
 * for the eye, to gather shelves under a heading. Only a leaf `Category` can
 * be attached to a book. Every group therefore has at least one child; the
 * five real-world shelves that have none of their own (Audiobooks, Culinare,
 * Enciclopedii, Biografii, România) live as leaves under the catch-all
 * `ALTELE` group.
 *
 * Bilinguality (§D44, §D45): every group and category carries a Romanian and
 * an English label, both `NOT NULL` in the schema — the successor to the
 * compile-time `GENRE_LABELS` completeness guarantee. `MANGA` is the one group
 * whose source is English; it is deliberately **not translated** (`untranslated`
 * below), so its labels are the same English string in both columns, the same
 * way money stays in lei in both languages.
 *
 * `general: true` marks the one leaf per topic group that stands for
 * "this group, shelf unspecified". It is an ordinary selectable category, and
 * it is also the target the legacy-genre migration lands a book on when all we
 * knew about it was its group (see `LEGACY_GENRE_MAP`).
 */

export type SeedCategory = {
  code: string;
  ro: string;
  en: string;
  /** The "unspecified shelf in this group" leaf; the legacy-migration target. */
  general?: boolean;
};

export type SeedGroup = {
  code: string;
  ro: string;
  en: string;
  /** MANGA: labels are English in both languages, by decision (§D45). */
  untranslated?: boolean;
  categories: SeedCategory[];
};

/** Shorthand for a Romanian leaf that also needs an English shelf sign. */
const c = (code: string, ro: string, en: string, general = false): SeedCategory =>
  general ? { code, ro, en, general } : { code, ro, en };

export const CATEGORY_SEED: SeedGroup[] = [
  {
    code: "ART_ARCHITECTURE",
    ro: "Artă, arhitectură",
    en: "Art & architecture",
    categories: [
      c("ART_ARCHITECTURE__GENERAL", "Generalități", "General", true),
      c("ART_ARCHITECTURE__ART_THEORY", "Teoria artei", "Art theory"),
      c("ART_ARCHITECTURE__DRAWING", "Tehnici de desen", "Drawing technique"),
      c("ART_ARCHITECTURE__ART_HISTORY", "Istoria artei", "Art history"),
      c("ART_ARCHITECTURE__PAINTING", "Pictură, grafică, alte forme artistice", "Painting, graphics & other art forms"),
      c("ART_ARCHITECTURE__PHOTOGRAPHY", "Fotografie", "Photography"),
      c("ART_ARCHITECTURE__COMMERCIAL", "Artă comercială și industrială", "Commercial & industrial art"),
      c("ART_ARCHITECTURE__INTERIOR", "Design interior", "Interior design"),
      c("ART_ARCHITECTURE__ARCHITECTURE", "Arhitectură", "Architecture"),
      c("ART_ARCHITECTURE__THEATRE", "Teatru", "Theatre"),
      c("ART_ARCHITECTURE__FILM_TV", "Film, TV, radio", "Film, TV & radio"),
      c("ART_ARCHITECTURE__DANCE", "Dans, performing arts", "Dance & performing arts"),
      c("ART_ARCHITECTURE__MUSIC", "Muzică", "Music"),
    ],
  },
  {
    code: "LINGUISTICS_DICTIONARIES",
    ro: "Lingvistică, dicționare",
    en: "Linguistics & dictionaries",
    categories: [
      c("LINGUISTICS_DICTIONARIES__GENERAL", "Generalități", "General", true),
      c("LINGUISTICS_DICTIONARIES__DICTIONARIES", "Dicționare", "Dictionaries"),
      c("LINGUISTICS_DICTIONARIES__GRAMMAR", "Gramatică", "Grammar"),
      c("LINGUISTICS_DICTIONARIES__CREATIVE_WRITING", "Creative writing", "Creative writing"),
      c("LINGUISTICS_DICTIONARIES__HISTORY_OF_LANGUAGE", "Istoria limbajului", "History of language"),
      c("LINGUISTICS_DICTIONARIES__LINGUISTICS", "Lingvistică", "Linguistics"),
    ],
  },
  {
    code: "ROMANIAN_MAGAZINES",
    ro: "Reviste - Limba română",
    en: "Magazines — Romanian",
    categories: [
      c("ROMANIAN_MAGAZINES__ARHITEXT", "Arhitext design", "Arhitext design"),
      c("ROMANIAN_MAGAZINES__CSF", "CSF", "CSF"),
      c("ROMANIAN_MAGAZINES__DECAT_O_REVISTA", "Decât o Revistă", "Decât o Revistă"),
      c("ROMANIAN_MAGAZINES__SECOLUL_21", "Fundația Culturală Secolul 21", "Fundația Culturală Secolul 21"),
      c("ROMANIAN_MAGAZINES__IGLOO", "Igloo", "Igloo"),
      c("ROMANIAN_MAGAZINES__IOCAN", "Iocan", "Iocan"),
      c("ROMANIAN_MAGAZINES__LETTRE", "Lettre Internationale", "Lettre Internationale"),
      c("ROMANIAN_MAGAZINES__REVISTA_ARTA", "Revista Arta", "Revista Arta"),
      c("ROMANIAN_MAGAZINES__REVISTA_FILM", "Revista Film", "Revista Film"),
      c("ROMANIAN_MAGAZINES__COMUNICARE", "Revista română de comunicare și relații publice", "Revista română de comunicare și relații publice"),
      c("ROMANIAN_MAGAZINES__SCENA9", "Scena9", "Scena9"),
      c("ROMANIAN_MAGAZINES__TODAY_SOFTWARE", "Today Software", "Today Software"),
      c("ROMANIAN_MAGAZINES__ZEPPELIN", "Zeppelin", "Zeppelin"),
      c("ROMANIAN_MAGAZINES__OTHER", "Alte reviste", "Other magazines", true),
    ],
  },
  {
    code: "FOREIGN_LANGUAGES",
    ro: "Limbi străine",
    en: "Foreign languages",
    categories: [
      c("FOREIGN_LANGUAGES__GENERAL", "Generalități", "General", true),
      c("FOREIGN_LANGUAGES__LEARNING", "Învățarea limbilor străine", "Language learning"),
      c("FOREIGN_LANGUAGES__DICTIONARIES", "Dicționare", "Dictionaries"),
    ],
  },
  {
    code: "POETRY_THEATRE",
    ro: "Poezie, teatru, studii literare",
    en: "Poetry, theatre & literary studies",
    categories: [
      c("POETRY_THEATRE__GENERAL", "Generalități", "General", true),
      c("POETRY_THEATRE__POETRY", "Poezie", "Poetry"),
      c("POETRY_THEATRE__PLAYS", "Piese de teatru, scenarii", "Plays & screenplays"),
      c("POETRY_THEATRE__ESSAYS", "Eseistică", "Essays"),
      c("POETRY_THEATRE__ANTHOLOGIES", "Antologii", "Anthologies"),
      c("POETRY_THEATRE__CRITICISM", "Istorie și critică", "Literary history & criticism"),
    ],
  },
  {
    code: "FICTION",
    ro: "Ficțiune",
    en: "Fiction",
    categories: [
      c("FICTION__GENERAL", "Generalități", "General", true),
      c("FICTION__CLASSICS", "Clasici", "Classics"),
      c("FICTION__MODERN", "Moderni, contemporani", "Modern & contemporary"),
      c("FICTION__CRIME", "Crime, mister", "Crime & mystery"),
      c("FICTION__THRILLER", "Thriller, horror", "Thriller & horror"),
      c("FICTION__YOUNG_ADULT", "Young adult", "Young adult"),
      c("FICTION__ADVENTURE", "Aventură", "Adventure"),
      c("FICTION__SF", "SF", "Science fiction"),
      c("FICTION__FANTASY", "Fantasy", "Fantasy"),
      c("FICTION__EROTIC", "Ficțiune erotică", "Erotic fiction"),
      c("FICTION__MYTH_HISTORICAL", "Ficțiune mitologică și istorică", "Mythological & historical fiction"),
      c("FICTION__ROMANCE", "Romance", "Romance"),
      c("FICTION__SHORT_STORIES", "Proză scurtă, altele", "Short stories & other"),
    ],
  },
  {
    code: "COMICS",
    ro: "Benzi desenate",
    en: "Comics & graphic novels",
    categories: [
      c("COMICS__GENERAL", "Generalități", "General", true),
      c("COMICS__GRAPHIC_NOVELS", "Romane ilustrate", "Graphic novels"),
      c("COMICS__COMICS", "Comics", "Comics"),
    ],
  },
  {
    code: "TRAVEL_GUIDES",
    ro: "Ghiduri și hărți turistice, atlase",
    en: "Travel guides, maps & atlases",
    categories: [
      c("TRAVEL_GUIDES__GENERAL", "Generalități", "General", true),
      c("TRAVEL_GUIDES__ATLASES", "Atlase, hărți, referințe geografice", "Atlases, maps & geographic reference"),
      c("TRAVEL_GUIDES__TOURISM", "Turism și călătorii", "Tourism & travel"),
    ],
  },
  {
    code: "HISTORY",
    ro: "Istorie",
    en: "History",
    categories: [
      c("HISTORY__GENERAL", "Istorie generală", "General history", true),
      c("HISTORY__ARCHAEOLOGY", "Arheologie", "Archaeology"),
      c("HISTORY__EUROPE", "Istoria Europei", "History of Europe"),
      c("HISTORY__ROMANIANS", "Istoria românilor", "History of the Romanians"),
      c("HISTORY__MILITARY", "Istorie militară, apărare", "Military history & defence"),
      c("HISTORY__MUSEOLOGY", "Muzeologie", "Museology"),
      c("HISTORY__INTERNATIONAL_RELATIONS", "Relații internaționale", "International relations"),
      c("HISTORY__WORLD", "Istorie universală", "World history"),
      c("HISTORY__ECONOMIC", "Istorie economică", "Economic history"),
      c("HISTORY__MENTALITIES", "Istoria mentalităților", "History of mentalities"),
      c("HISTORY__SECRET", "Istorii secrete", "Secret histories"),
    ],
  },
  {
    code: "RELIGION",
    ro: "Religie",
    en: "Religion",
    categories: [
      c("RELIGION__GENERAL", "Generalități, istoria religiilor", "General & history of religions", true),
      c("RELIGION__CHRISTIANITY", "Creștinism", "Christianity"),
      c("RELIGION__BUDDHISM", "Buddhism", "Buddhism"),
      c("RELIGION__HINDUISM", "Hinduism", "Hinduism"),
      c("RELIGION__ISLAM", "Islam", "Islam"),
      c("RELIGION__JUDAISM", "Iudaism", "Judaism"),
      c("RELIGION__OTHER", "Alte religii și credințe", "Other religions & beliefs"),
      c("RELIGION__OCCULT", "Ocultism și ezoterism", "Occultism & esotericism"),
    ],
  },
  {
    code: "PHILOSOPHY",
    ro: "Filosofie",
    en: "Philosophy",
    categories: [
      c("PHILOSOPHY__GENERAL", "Generalități", "General", true),
      c("PHILOSOPHY__WESTERN_HISTORY", "Istoria filosofiei occidentale", "History of Western philosophy"),
      c("PHILOSOPHY__METAPHYSICS", "Metafizică și ontologie", "Metaphysics & ontology"),
      c("PHILOSOPHY__EPISTEMOLOGY", "Epistemologie, teoria cunoașterii", "Epistemology & theory of knowledge"),
      c("PHILOSOPHY__LOGIC", "Logică", "Logic"),
      c("PHILOSOPHY__MIND", "Filosofia minții", "Philosophy of mind"),
      c("PHILOSOPHY__LANGUAGE", "Filosofia limbajului", "Philosophy of language"),
      c("PHILOSOPHY__AESTHETICS", "Estetică", "Aesthetics"),
      c("PHILOSOPHY__SEMIOTICS", "Semiotică", "Semiotics"),
      c("PHILOSOPHY__ETHICS", "Etică și morală", "Ethics & morality"),
      c("PHILOSOPHY__SCIENCE", "Filosofia științei", "Philosophy of science"),
      c("PHILOSOPHY__SOCIAL_POLITICAL", "Filosofie social-politică", "Social & political philosophy"),
      c("PHILOSOPHY__NON_WESTERN", "Filosofie non-occidentală", "Non-Western philosophy"),
      c("PHILOSOPHY__POPULAR", "Filosofie populară", "Popular philosophy"),
    ],
  },
  {
    code: "PSYCHOLOGY",
    ro: "Psihologie",
    en: "Psychology",
    categories: [
      c("PSYCHOLOGY__GENERAL", "Teorie generală, școli", "General theory & schools", true),
      c("PSYCHOLOGY__METHODOLOGY", "Metodologie, testare", "Methodology & testing"),
      c("PSYCHOLOGY__CHILD", "Psihologia copilului și dezvoltării", "Child & developmental psychology"),
      c("PSYCHOLOGY__PSYCHOTHERAPY", "Psihoterapie", "Psychotherapy"),
      c("PSYCHOLOGY__AGE_GENDER", "Psihologia vârstelor și a sexelor", "Psychology of age & gender"),
      c("PSYCHOLOGY__FAMILY", "Psihologia familiei", "Family psychology"),
      c("PSYCHOLOGY__SOCIAL", "Psihologia socială și de grup", "Social & group psychology"),
      c("PSYCHOLOGY__OCCUPATIONAL", "Psihologia ocupațională", "Occupational psychology"),
      c("PSYCHOLOGY__FORENSIC", "Psihologia criminalistică și legală", "Forensic & legal psychology"),
      c("PSYCHOLOGY__NEURO", "Neuropsihologie, biopsihologie", "Neuropsychology & biopsychology"),
      c("PSYCHOLOGY__EMOTIONS", "Psihologia emoțiilor", "Psychology of emotions"),
      c("PSYCHOLOGY__COGNITIVE", "Psihologia cognitivă", "Cognitive psychology"),
      c("PSYCHOLOGY__IDENTITY", "Eu, ego, identitate, personalitate", "Self, ego, identity & personality"),
    ],
  },
  {
    code: "SOCIAL_SCIENCES_POLITICS",
    ro: "Științe sociale. Politică",
    en: "Social sciences & politics",
    categories: [
      c("SOCIAL_SCIENCES_POLITICS__GENERAL", "Generalități", "General", true),
      c("SOCIAL_SCIENCES_POLITICS__CULTURAL", "Studii culturale", "Cultural studies"),
      c("SOCIAL_SCIENCES_POLITICS__INTERDISCIPLINARY", "Studii interdisciplinare", "Interdisciplinary studies"),
      c("SOCIAL_SCIENCES_POLITICS__SOCIOLOGY", "Sociologie, antropologie", "Sociology & anthropology"),
      c("SOCIAL_SCIENCES_POLITICS__CRIMINOLOGY", "Criminologie", "Criminology"),
      c("SOCIAL_SCIENCES_POLITICS__EDUCATION", "Educație", "Education"),
      c("SOCIAL_SCIENCES_POLITICS__GOVERNANCE", "Politologie și guvernare", "Political science & governance"),
      c("SOCIAL_SCIENCES_POLITICS__INTERNATIONAL_RELATIONS", "Relații internaționale", "International relations"),
      c("SOCIAL_SCIENCES_POLITICS__PARTIES", "Doctrine și partide politice", "Political doctrines & parties"),
      c("SOCIAL_SCIENCES_POLITICS__DEFENCE", "Apărare națională", "National defence"),
      c("SOCIAL_SCIENCES_POLITICS__JOURNALISM", "Publicistică și jurnalism", "Journalism"),
    ],
  },
  {
    code: "MARKETING_COMMUNICATION",
    ro: "Marketing și comunicare",
    en: "Marketing & communication",
    categories: [
      c("MARKETING_COMMUNICATION__GENERAL", "Generalități", "General", true),
      c("MARKETING_COMMUNICATION__ADVERTISING", "Publicitate și media", "Advertising & media"),
      c("MARKETING_COMMUNICATION__PR", "Relații publice", "Public relations"),
      c("MARKETING_COMMUNICATION__INDUSTRY", "Industria comunicării", "Communication industry"),
    ],
  },
  {
    code: "BUSINESS_ECONOMY",
    ro: "Business și economie",
    en: "Business & economics",
    categories: [
      c("BUSINESS_ECONOMY__GENERAL", "Generalități", "General", true),
      c("BUSINESS_ECONOMY__ECONOMICS", "Economie", "Economics"),
      c("BUSINESS_ECONOMY__STRATEGY", "Strategie", "Strategy"),
      c("BUSINESS_ECONOMY__FINANCE", "Finanțe și contabilitate", "Finance & accounting"),
      c("BUSINESS_ECONOMY__BUSINESS", "Business", "Business"),
      c("BUSINESS_ECONOMY__ENTREPRENEURSHIP", "Antreprenoriat", "Entrepreneurship"),
      c("BUSINESS_ECONOMY__MANAGEMENT", "Tehnici de management", "Management technique"),
      c("BUSINESS_ECONOMY__SALES", "Marketing și vânzări", "Marketing & sales"),
    ],
  },
  {
    code: "LAW",
    ro: "Drept",
    en: "Law",
    categories: [
      c("LAW__GENERAL", "Teorie generală, jurisprudență", "General theory & jurisprudence", true),
      c("LAW__INTERNATIONAL", "Drept internațional", "International law"),
      c("LAW__CIVIL", "Drept civil", "Civil law"),
      c("LAW__COMMERCIAL", "Drept comercial", "Commercial law"),
      c("LAW__CONSTITUTIONAL", "Drept constituțional", "Constitutional law"),
      c("LAW__CRIMINAL", "Drept penal", "Criminal law"),
      c("LAW__LABOUR", "Legislația muncii", "Labour law"),
      c("LAW__ENVIRONMENT_TRANSPORT", "Dreptul mediului, transport", "Environmental & transport law"),
      c("LAW__FAMILY", "Dreptul familiei", "Family law"),
      c("LAW__FINANCIAL", "Drept financiar", "Financial law"),
      c("LAW__INTELLECTUAL_PROPERTY", "Proprietate intelectuală", "Intellectual property"),
      c("LAW__SOCIAL", "Drept social", "Social law"),
    ],
  },
  {
    code: "MEDICINE",
    ro: "Medicină",
    en: "Medicine",
    categories: [
      c("MEDICINE__GENERAL", "Aspecte generale", "General aspects", true),
      c("MEDICINE__PRECLINICAL", "Preclinic: anatomie, fiziologie", "Preclinical: anatomy & physiology"),
      c("MEDICINE__CLINICAL", "Medicină clinică și internă", "Clinical & internal medicine"),
      c("MEDICINE__DENTISTRY", "Stomatologie", "Dentistry"),
      c("MEDICINE__PHARMACOLOGY", "Farmacologie", "Pharmacology"),
      c("MEDICINE__PSYCHIATRY", "Psihiatrie, psihologie clinică, terapii", "Psychiatry, clinical psychology & therapies"),
      c("MEDICINE__SPORTS", "Medicină sportivă", "Sports medicine"),
      c("MEDICINE__OTHER_FORMS", "Alte forme de medicină", "Other forms of medicine"),
      c("MEDICINE__SURGERY", "Chirurgie", "Surgery"),
      c("MEDICINE__NURSING", "Îngrijire și asistență", "Nursing & care"),
      c("MEDICINE__REFERENCE", "Ghiduri și referințe", "Guides & reference"),
      c("MEDICINE__COMPLEMENTARY", "Medicină complementară", "Complementary medicine"),
      c("MEDICINE__VETERINARY", "Medicină veterinară", "Veterinary medicine"),
    ],
  },
  {
    code: "EXACT_SCIENCES_MATH",
    ro: "Științe exacte. Matematici",
    en: "Exact sciences & mathematics",
    categories: [
      c("EXACT_SCIENCES_MATH__GENERAL", "Generalități", "General", true),
      c("EXACT_SCIENCES_MATH__MATH", "Matematică", "Mathematics"),
      c("EXACT_SCIENCES_MATH__HISTORY_OF_SCIENCE", "Istoria științei și generalități", "History of science"),
      c("EXACT_SCIENCES_MATH__ASTRONOMY", "Astronomie, spațiu, timp", "Astronomy, space & time"),
      c("EXACT_SCIENCES_MATH__PHYSICS", "Fizică", "Physics"),
      c("EXACT_SCIENCES_MATH__CHEMISTRY", "Chimie", "Chemistry"),
      c("EXACT_SCIENCES_MATH__BIOLOGY", "Biologie", "Biology"),
    ],
  },
  {
    code: "NATURE_ENVIRONMENT",
    ro: "Natură și mediu",
    en: "Nature & environment",
    categories: [
      c("NATURE_ENVIRONMENT__GENERAL", "Generalități", "General", true),
      c("NATURE_ENVIRONMENT__EARTH_SCIENCES", "Științele Pământului", "Earth sciences"),
      c("NATURE_ENVIRONMENT__GEOGRAPHY", "Geografie", "Geography"),
      c("NATURE_ENVIRONMENT__ECOLOGY", "Mediu și ecologie", "Environment & ecology"),
    ],
  },
  {
    code: "TECHNOLOGY",
    ro: "Tehnică și tehnologie",
    en: "Engineering & technology",
    categories: [
      c("TECHNOLOGY__GENERAL", "Tehnologie: generalități", "Technology: general", true),
      c("TECHNOLOGY__MECHANICS", "Mecanică și știința materialelor", "Mechanics & materials science"),
      c("TECHNOLOGY__ELECTRONICS", "Electronică și comunicații", "Electronics & communications"),
      c("TECHNOLOGY__CONSTRUCTION", "Construcții", "Construction"),
      c("TECHNOLOGY__OTHER", "Alte tehnologii", "Other technologies"),
      c("TECHNOLOGY__AGRICULTURE", "Agricultură", "Agriculture"),
    ],
  },
  {
    code: "COMPUTERS_INTERNET",
    ro: "Computere și internet",
    en: "Computers & internet",
    categories: [
      c("COMPUTERS_INTERNET__GENERAL", "Generalități", "General", true),
      c("COMPUTERS_INTERNET__DIGITAL_LIFESTYLE", "Lifestyle digital", "Digital lifestyle"),
      c("COMPUTERS_INTERNET__PROGRAMMING", "Programare, dezvoltare", "Programming & development"),
      c("COMPUTERS_INTERNET__NETWORKS", "Rețele și comunicații", "Networks & communications"),
      c("COMPUTERS_INTERNET__AI", "Inteligență artificială", "Artificial intelligence"),
    ],
  },
  {
    code: "HEALTH_SELF_DEVELOPMENT",
    ro: "Sănătate, dezvoltare personală",
    en: "Health & personal development",
    categories: [
      c("HEALTH_SELF_DEVELOPMENT__GENERAL", "Generalități", "General", true),
      c("HEALTH_SELF_DEVELOPMENT__FITNESS", "Fitness și dietă", "Fitness & diet"),
      c("HEALTH_SELF_DEVELOPMENT__PARENTING", "Parenting", "Parenting"),
      c("HEALTH_SELF_DEVELOPMENT__NATURAL_MEDICINE", "Medicină naturistă, îngrijire", "Natural medicine & care"),
      c("HEALTH_SELF_DEVELOPMENT__FAMILY_HEALTH", "Familie, sănătate", "Family & health"),
      c("HEALTH_SELF_DEVELOPMENT__SELF_DEVELOPMENT", "Dezvoltare personală", "Personal development"),
      c("HEALTH_SELF_DEVELOPMENT__PARANORMAL", "Fenomene paranormale", "Paranormal phenomena"),
      c("HEALTH_SELF_DEVELOPMENT__DREAMS", "Interpretarea viselor", "Dream interpretation"),
      c("HEALTH_SELF_DEVELOPMENT__COMPLEMENTARY", "Terapii complementare", "Complementary therapies"),
      c("HEALTH_SELF_DEVELOPMENT__ASTROLOGY", "Astrologie", "Astrology"),
      c("HEALTH_SELF_DEVELOPMENT__NUMEROLOGY", "Numerologie", "Numerology"),
      c("HEALTH_SELF_DEVELOPMENT__DIVINATION", "Cartomanție, alte preziceri", "Cartomancy & other divination"),
      c("HEALTH_SELF_DEVELOPMENT__MIND_BODY_SPIRIT", "Minte, corp, spirit", "Mind, body & spirit"),
    ],
  },
  {
    code: "LIFESTYLE_SPORT_LEISURE",
    ro: "Lifestyle, sport, timp liber",
    en: "Lifestyle, sport & leisure",
    categories: [
      c("LIFESTYLE_SPORT_LEISURE__GENERAL", "Generalități", "General", true),
      c("LIFESTYLE_SPORT_LEISURE__COLOURING", "Cărți de colorat pentru adulți", "Adult colouring books"),
      c("LIFESTYLE_SPORT_LEISURE__ANTIQUES", "Antichități, colecții", "Antiques & collections"),
      c("LIFESTYLE_SPORT_LEISURE__HOBBIES", "Hobby, jocuri", "Hobbies & games"),
      c("LIFESTYLE_SPORT_LEISURE__DECORATIVE", "Obiecte decorative", "Decorative objects"),
      c("LIFESTYLE_SPORT_LEISURE__SAILING", "Navigație", "Sailing"),
      c("LIFESTYLE_SPORT_LEISURE__AUTO", "Auto, transport, deplasare", "Cars, transport & travel"),
      c("LIFESTYLE_SPORT_LEISURE__HUMOUR", "Umor", "Humour"),
      c("LIFESTYLE_SPORT_LEISURE__FASHION", "Lifestyle, fashion", "Lifestyle & fashion"),
      c("LIFESTYLE_SPORT_LEISURE__HOME_GARDEN", "Casă, grădină, familie", "Home, garden & family"),
      c("LIFESTYLE_SPORT_LEISURE__NATURE_ANIMALS", "Lumea naturii, animale", "The natural world & animals"),
      c("LIFESTYLE_SPORT_LEISURE__SPORT", "Sport și recreere", "Sport & recreation"),
      c("LIFESTYLE_SPORT_LEISURE__TRAVEL", "Călătorii", "Travel"),
    ],
  },
  {
    code: "EDUCATIONAL_SOFTWARE",
    ro: "Soft educațional",
    en: "Educational software",
    categories: [
      c("EDUCATIONAL_SOFTWARE__GENERAL", "Generalități", "General", true),
      c("EDUCATIONAL_SOFTWARE__PRIMARY", "Primar", "Primary"),
      c("EDUCATIONAL_SOFTWARE__MIDDLE", "Gimnazial", "Middle school"),
      c("EDUCATIONAL_SOFTWARE__HIGH", "Liceal", "High school"),
      c("EDUCATIONAL_SOFTWARE__PACKAGES", "Pachete educaționale", "Educational packages"),
    ],
  },
  {
    // Source is English; not translated (§D45). Labels are identical in both
    // columns by construction — see the generator.
    code: "MANGA",
    ro: "Manga",
    en: "Manga",
    untranslated: true,
    categories: [
      c("MANGA__MYSTERY", "Mystery", "Mystery"),
      c("MANGA__SEINEN", "Seinen", "Seinen"),
      c("MANGA__SHONEN", "Shonen", "Shonen"),
      c("MANGA__COMEDY", "Comedy", "Comedy"),
      c("MANGA__SHOJO", "Shojo", "Shojo"),
      c("MANGA__JOSEI", "Josei", "Josei"),
      c("MANGA__DRAMA", "Drama", "Drama"),
      c("MANGA__ACTION_ADVENTURE", "Action & Adventure", "Action & Adventure"),
      c("MANGA__FANTASY", "Fantasy", "Fantasy"),
      c("MANGA__HORROR", "Horror", "Horror"),
      c("MANGA__ISEKAI", "Isekai", "Isekai"),
      c("MANGA__LGBTQ", "LGBTQ", "LGBTQ"),
      c("MANGA__MADE_INTO_ANIME", "Made into Anime", "Made into Anime"),
      c("MANGA__TIE_IN", "Movie, TV Tie-in", "Movie, TV Tie-in"),
      c("MANGA__ROMANCE", "Romance", "Romance"),
      c("MANGA__SCHOOL_LIFE", "School Life", "School Life"),
      c("MANGA__SCIENCE_FICTION", "Science Fiction", "Science Fiction"),
      c("MANGA__SLICE_OF_LIFE", "Slice of Life", "Slice of Life"),
      c("MANGA__SPORTS", "Sports", "Sports"),
      c("MANGA__THRILLER", "Thriller", "Thriller"),
      c("MANGA__VIDEO_GAME_TIE_IN", "Video Game Tie-in", "Video Game Tie-in"),
      c("MANGA__YAOI_BL", "Yaoi, BL", "Yaoi, BL"),
      c("MANGA__YURI", "Yuri", "Yuri"),
      c("MANGA__LIGHT_NOVEL", "Light Novel", "Light Novel"),
      c("MANGA__HISTORICAL", "Historical", "Historical"),
    ],
  },
  {
    // §D45 — the catch-all for shelves with no sub-categories of their own.
    // The five former top-level groups that had no children live here as
    // leaves, so the "a group is never a value" invariant stays absolute.
    code: "ALTELE",
    ro: "Altele",
    en: "Other",
    categories: [
      c("ALTELE__AUDIOBOOKS", "Audiobooks", "Audiobooks"),
      c("ALTELE__CULINARE", "Culinare", "Cooking"),
      c("ALTELE__ENCICLOPEDII", "Enciclopedii", "Encyclopedias"),
      c("ALTELE__BIOGRAFII", "Biografii, memorii, jurnale", "Biography, memoir & diaries"),
      c("ALTELE__ROMANIA", "România", "Romania"),
    ],
  },
];

/**
 * §D45 — where a pre-existing book lands, keyed by its old single-value
 * `genre` enum code. The old value was always a *group*, so a book only ever
 * told us its shelf-group and never its shelf; each maps to that group's
 * `general: true` leaf (or, for the five childless ones, to their new home
 * under `ALTELE`). Honest and lossless: we assert the group we knew and leave
 * the precise shelf unset rather than guessing one.
 *
 * The old list had exactly these 29 values (shared/src/enums.ts before §D45).
 */
export const LEGACY_GENRE_MAP: Record<string, string> = {
  AUDIOBOOKS: "ALTELE__AUDIOBOOKS",
  CULINARY: "ALTELE__CULINARE",
  ENCYCLOPEDIAS: "ALTELE__ENCICLOPEDII",
  BIOGRAPHIES: "ALTELE__BIOGRAFII",
  ROMANIA: "ALTELE__ROMANIA",
  ART_ARCHITECTURE: "ART_ARCHITECTURE__GENERAL",
  LINGUISTICS_DICTIONARIES: "LINGUISTICS_DICTIONARIES__GENERAL",
  ROMANIAN_MAGAZINES: "ROMANIAN_MAGAZINES__OTHER",
  FOREIGN_LANGUAGES: "FOREIGN_LANGUAGES__GENERAL",
  POETRY_THEATRE: "POETRY_THEATRE__GENERAL",
  FICTION: "FICTION__GENERAL",
  COMICS: "COMICS__GENERAL",
  TRAVEL_GUIDES: "TRAVEL_GUIDES__GENERAL",
  HISTORY: "HISTORY__GENERAL",
  RELIGION: "RELIGION__GENERAL",
  PHILOSOPHY: "PHILOSOPHY__GENERAL",
  PSYCHOLOGY: "PSYCHOLOGY__GENERAL",
  SOCIAL_SCIENCES_POLITICS: "SOCIAL_SCIENCES_POLITICS__GENERAL",
  MARKETING_COMMUNICATION: "MARKETING_COMMUNICATION__GENERAL",
  BUSINESS_ECONOMY: "BUSINESS_ECONOMY__GENERAL",
  LAW: "LAW__GENERAL",
  MEDICINE: "MEDICINE__GENERAL",
  EXACT_SCIENCES_MATH: "EXACT_SCIENCES_MATH__GENERAL",
  NATURE_ENVIRONMENT: "NATURE_ENVIRONMENT__GENERAL",
  TECHNOLOGY: "TECHNOLOGY__GENERAL",
  COMPUTERS_INTERNET: "COMPUTERS_INTERNET__GENERAL",
  HEALTH_SELF_DEVELOPMENT: "HEALTH_SELF_DEVELOPMENT__GENERAL",
  LIFESTYLE_SPORT_LEISURE: "LIFESTYLE_SPORT_LEISURE__GENERAL",
  EDUCATIONAL_SOFTWARE: "EDUCATIONAL_SOFTWARE__GENERAL",
};
