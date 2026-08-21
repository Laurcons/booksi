# Bookcsi — Decizii de model și puncte deschise

Documentul acoperă găurile de definiție găsite la analiza logică a backlogului inițial.
Fiecare decizie de mai jos e deja reflectată în [USER_STORIES.md](USER_STORIES.md).
Un singur punct rămâne **DESCHIS** (D2) și blochează începerea Sprintului 1.

---

## Model de date

Identificatorii sunt în engleză peste tot — cod, bază de date, enum-uri. Româna apare doar în
textele afișate, prin mape de traducere. Vezi §D21.

### Entitatea `Book`

| Câmp | Tip | Sursă |
|---|---|---|
| `id` | cuid | System-generated |
| `userId` | fk → `User` | System-generated |
| `title` | text (obligatoriu) | User-input / Third-party |
| `author` | text | User-input / Third-party |
| `isbn` | text, nullable | User-input / Search-assisted |
| `totalPages` | int, nullable | Third-party / User-input |
| `genre` | enum din listă controlată, nullable | User-input |
| `cover` | relație 1:1 → `Cover`, nullable | Third-party (descărcată) / User-input (upload) |
| `olEditionKey` | text, nullable | Third-party |
| `status` | enum: WISHLIST, PURCHASED, READING, FINISHED, ABANDONED | User-input |
| `favorite` | bool | User-input |
| `pagesRead` | int, default 0 | User-input |
| `rating` | int 1–5, nullable | User-input |
| `estimatedPrice` | decimal, nullable | User-input |
| `paidPrice` | decimal, nullable | User-input |
| `createdAt` | timestamp | System-generated |
| `updatedAt` | timestamp | System-generated |
| `purchasedOn` | date, nullable | System-generated, user-overridable |
| `startedOn` | date, nullable | System-generated, user-overridable |
| `finishedOn` | date, nullable | System-generated, user-overridable |

`manuallyEditedFields` a fost eliminat odată cu S4.4 — vezi §D25.

### Entitatea `User`
`id` (cuid), `googleId` (unic), `email` (unic), `name`, `avatarUrl`, `createdAt`.
Toate populate din profilul Google la prima autentificare (S0.1).

### Entitatea `Cover`
`bookId` (PK, 1:1 cu `Book`), `data` (LONGBLOB), `mimeType`, `source` (OPEN_LIBRARY | UPLOAD),
`updatedAt`. Tabel separat din motivele de la §D18; `updatedAt` e versiunea din URL (§D26).

### Entitatea `Settings`
Una per utilizator: `userId` (PK), `monthlyBudget` (decimal, nullable),
`yearlyBudget` (decimal, nullable), `currency` (default RON). Rândul se creează la prima
salvare, nu la înregistrare. Doar `monthlyBudget` e expus în API: celelalte două coloane
rămân nefolosite (§D31).

### Valori derivate — nu se stochează niciodată
`progres_procent`, `total_cheltuit`, `total_pagini_citite`, `total_carti_citite`,
`rating_mediu`, `cost_total_wishlist`, `buget_ramas`.

---

## Corecții față de categorizarea inițială a surselor

**Genul literar** a fost mutat din *Third-party* în *User-input*. Motiv: Open Library nu
returnează un gen, ci `subjects` — liste libere de zeci până la sute de tag-uri în engleză,
inconsistente ca granularitate („Fiction", „American fiction", „New York Times bestseller").
Nu sunt utilizabile ca fațete de filtrare. Se folosesc doar ca sugestie la adăugare.

**S-a adăugat o categorie de sursă nouă:** *System-generated, user-overridable*. Acoperă cele
trei date de status (D1). Lipsea din categorizare, și exact lipsa ei bloca Epicele de buget și
statistici.

---

## Decizii luate

### D1 — Datele de status (era gaura majoră)
Backlogul inițial cerea „bani cheltuiți **în timp**" și „cărți citite **pe lună**", dar nu avea
în model nicio dată în afară de `data_adaugare`. Cele două nu sunt echivalente: o carte citită
în 2019 și introdusă azi ar fi apărut în statisticile lunii curente.

**Decizie:** `data_cumparare`, `data_start_lectura`, `data_terminare` — setate automat la
tranziția de status, editabile manual oricând.

### D2 — Persistență și conturi — rezolvat
Nicăieri în backlogul inițial nu se spunea unde trăiesc datele.

**Decizie:** persistență server-side în **MariaDB**, accesată prin Prisma (`provider = "mysql"`),
expusă de un backend NestJS. Aplicația e **multi-user**, cu autentificare prin **Google OAuth 2.0**
ca unică metodă de login.

Consecințe:
- Datele supraviețuiesc schimbării de browser și device.
- Aplicația necesită conexiune — nu există mod offline în MVP.
- Fiecare entitate e legată de un `userId`, iar orice interogare e filtrată pe utilizatorul
  autentificat (S0.3).
- Apare **Sprint 0**, singurul care nu livrează valoare de unul singur.

MariaDB în locul MongoDB-ului evaluat inițial: modelul e complet relațional, iar pe `mysql`
Prisma oferă `prisma migrate` cu istoric de migrări versionat în git — ceea ce conectorul de
MongoDB nu suportă (acolo există doar `db push`).

### D3 — Paginile citite: valoare curentă, nu istoric
Se stochează un singur `pagini_citite`. E suficient pentru progresul per carte și pentru
„cărți citite pe lună". Nu permite grafice de tip „pagini pe săptămână" — dacă acelea vor fi
vreodată dorite, e nevoie de o entitate `SesiuneLectura (data, pagina)`, iar schimbarea nu e
retroactivă (datele istorice nu se pot reconstrui). Decizia se ia acum tocmai din acest motiv.

### D4 — Lipsa numărului de pagini
`number_of_pages` lipsește frecvent din Open Library, mai ales pe edițiile non-engleze.
Fără el, procentul de progres e o împărțire la null.

**Decizie:** `total_pagini` e nullable. Când lipsește, se cere o dată la trecerea în `Citesc`
(cu skip permis), iar progresul se afișează ca „pag. 143" fără procent și fără bară.

### D5 — Rating mediu
Media se calculează doar peste cărțile care au rating. Includerea celor nerated ar trage media
în jos cu fiecare carte neevaluată.

### D6 — Două prețuri, nu unul
`pret_estimat` (wishlist, estimare proprie — Open Library nu furnizează prețuri) și
`pret_platit` (suma reală). Bugetul numără exclusiv `pret_platit`. Mutarea în „Cumpărat"
precompletează al doilea din primul.

### D7 — Works vs. editions în Open Library
Search API returnează *works*; coperta, ISBN-ul și numărul de pagini aparțin însă *edițiilor*.

**Decizie:** la selecția unui rezultat se ia automat ediția implicită (`cover_edition_key`).
Utilizatorul nu alege ediția — dar poate corecta orice câmp rezultat (S4.4).

### D8 — Coperta se stochează ca imagine, nu ca URL
Un URL către Open Library se rupe când serviciul e indisponibil, și ar necesita oricum un al
doilea mecanism pentru upload-urile manuale.

**Decizie:** imaginea se descarcă și se stochează local la momentul selecției. Rezolvă simultan
cerința de cache, funcționarea offline și upload-ul manual, cu un singur mecanism.

### D9 — Bugetul nu se reportează
Fiecare lună pornește de la bugetul complet; economiile nu se cumulează. E comportamentul
așteptat pentru un buget de tip „limită", nu de tip „portofel".

### D10 — „Pagini totale" e o singură metrică, definită o dată
Termenul apărea în trei locuri cu înțelesuri diferite (suma paginilor din bibliotecă vs. pagini
efectiv citite). Rămâne o singură metrică — „pagini citite" — cu regula de agregare din S7.1,
folosită identic pe dashboard și în pagina de statistici.

### D11 — Statusul „Abandonat"
Fluxul inițial era o săgeată fără ieșire. Fără o stare terminală de abandon, o carte lăsată
rămâne veșnic „Citesc" și denaturează atât progresul, cât și statisticile.

**Decizie:** `Abandonat` există, contribuie la „pagini citite" cu paginile parcurse, nu se
numără la „cărți citite", și poate primi rating.

### D12 — Fluxul de status nu e o constrângere
Orice status e setabil direct, în orice ordine, inclusiv înapoi (recitiri). Săgeata
Wishlist → Cumpărat → Citesc → Terminat determină doar butonul de acțiune sugerată.
Un flux strict liniar ar face imposibilă introducerea unei biblioteci deja existente.

### D13 — ISBN nu e cheie primară
O carte are ISBN-10, ISBN-13 și câte unul per ediție; în plus, aceeași carte poate exista
legitim de două ori. Cheia e `id`-ul intern; ISBN-ul e un simplu atribut. Duplicatele produc
un avertisment, nu un blocaj.

### D14 — Favorit e ortogonal statusului
Se poate marca favorită și o carte din wishlist. Filtrele din galerie se combină liber.

### D15 — Raftul vizual
Era complet nedefinit. Regulile sunt acum în S8.2: doar cărțile deținute, grosimea din numărul
de pagini, culoarea din gen, ordonare după data cumpărării.

### D16 — Monedă
O singură monedă globală, RON implicit, configurabilă în setări (story S6.4). Nu se face
conversie valutară: schimbarea monedei schimbă simbolul, nu recalculează sumele existente.

> **Nu se implementează.** S6.4 a fost scos din Sprint 6. Sumele rămân în lei, scris în
> interfață; coloana `currency` rămâne în tabel cu implicitul ei. Vezi §D31.

### D17 — Lista controlată de genuri
Genul e user-input dintr-o listă fixă, cu **o singură valoare per carte**. Multi-gen ar fi mai
fidel realității, dar complică filtrarea din S5.3 fără câștig real la scara unei biblioteci
personale.

Lista inițială (identificator → etichetă afișată), înlocuită de §D39 cu lista de 29 de
categorii de mai jos — structura deciziei (o valoare, listă fixă, fără story de administrare)
rămâne neschimbată:

`FICTION` → Ficțiune · `SCIFI` → SF · `FANTASY` → Fantasy · `THRILLER` → Thriller / Mister ·
`ROMANCE` → Romance · `HISTORICAL` → Roman istoric · `MEMOIR` → Biografie / Memorii ·
`NONFICTION` → Non-ficțiune · `SELF_HELP` → Dezvoltare personală · `BUSINESS` → Business /
Economie · `SCIENCE` → Științe · `PHILOSOPHY` → Filosofie · `PSYCHOLOGY` → Psihologie ·
`POETRY` → Poezie · `COMICS_MANGA` → Bandă desenată / Manga · `CHILDREN_YA` → Copii /
Young Adult · `OTHER` → Altele

Lista e o constantă în cod, nu o entitate în bază — nu există story de administrare a genurilor.
La adăugarea prin Open Library (S4.1), `subjects` se pot folosi pentru a **presugera** un gen din
listă, dar niciodată pentru a scrie direct valoarea.

### D18 — Unde stau coperțile, acum că există backend
D8 a stabilit *că* imaginea se stochează, nu URL-ul. Cu backend, apare întrebarea *unde*.

**Decizie:** binar în baza de date, într-un **tabel separat** `Coperta`, în relație 1:1 cu
`Carte`. Coloană `LONGBLOB`, plus `mimeType` și sursa (Open Library / upload manual).

Tabelul separat nu e cosmetic: Prisma nu are lazy loading, deci o copertă ținută pe rândul
`Carte` ar fi încărcată la fiecare listare a bibliotecii, chiar și când se afișează doar titluri.
Cu relație 1:1, blob-ul se citește doar când e cerut explicit.

Coperțile sunt de ordinul zecilor de KB, deci stocarea în baza de date păstrează backup-ul
atomic (un singur `mysqldump`, fără director de fișiere de sincronizat separat). Se servesc
printr-un endpoint dedicat, cu `Cache-Control` agresiv — coperta unei cărți nu se schimbă
niciodată după adăugare.

### D19 — Genurile devin enum în baza de date
D17 stabilea lista ca simplă constantă în cod, alegere făcută pe premisa MongoDB. Pe MariaDB,
lista devine un `enum` Prisma, deci și o constrângere reală în schemă. Rămâne totuși **enum, nu
tabel**: nu există story de administrare a genurilor, iar o modificare a listei e o migrare, nu
o operație de utilizator.

### D20 — Sesiune prin cookie httpOnly, nu token în localStorage
Un JWT ținut în `localStorage` e citibil din orice JavaScript injectat. Sesiunea se transportă
într-un cookie `httpOnly`, `Secure`, `SameSite=Lax`, iar frontendul nu are niciodată acces
programatic la ea. Cererile din React pornesc cu `credentials: "include"`.

Consecință în dev: frontendul (Vite, `:5173`) și API-ul (`:3000`) sunt origini diferite, deci
backendul are nevoie de CORS cu `credentials: true` și origine explicită — nu `*`.

### D21 — Codul în engleză, interfața în română
Toți identificatorii sunt în engleză: nume de fișiere, variabile, funcții, câmpuri de bază de
date, valori de enum, rute de API. Româna există exclusiv în textele văzute de utilizator.

Puntea o fac mape de traducere explicite (`STATUS_LABEL`, `GENRE_LABEL`), nu conversii implicite
și nici enum-uri cu valori românești. Avantajul practic: dacă apare vreodată o a doua limbă,
mapele sunt singurul lucru care se dublează — restul codului nu se atinge.

**Amendat de §D44.** A doua limbă a apărut, iar ultima frază s-a dovedit pe jumătate falsă: mapele
chiar nu au cerut decât o coloană în plus, dar nu erau singura română din cod — mesajele de validare
din `shared/` și vreo două sute de string-uri de JSX au trebuit extrase. Prima jumătate a deciziei —
identificatori în engleză, peste tot — rămâne neatinsă.

### D22 — Structura de monorepo
`frontend/` și `backend/` la rădăcină, nu `apps/web` și `apps/api`. Gestionar: npm workspaces,
declarate în `package.json`-ul rădăcină.

Amendat de §D37: s-a adăugat `kobo-frontend/`, al doilea frontend.

### D23 — Delogarea invalidează token-ul, prin `tokenVersion`
Ștergerea cookie-ului ia doar copia din browser. Token-ul e semnat și se verifică singur, deci
orice copie făcută înainte de delogare rămâne valabilă încă 30 de zile — delogarea „reușea"
fără să încheie sesiunea.

`User` are un contor `tokenVersion`. Fiecare token poartă valoarea de la semnare, iar
`JwtStrategy` refuză token-ul a cărui valoare a rămas în urmă. Delogarea incrementează
contorul. Verificarea nu costă nimic în plus: strategia interoga oricum rândul la fiecare
cerere, ca să confirme că utilizatorul mai există.

**Un singur contor per utilizator, deci delogarea închide sesiunile de pe toate
dispozitivele.** Revocarea per-dispozitiv cere un tabel de sesiuni active, adică o funcționalitate
în sine — S0.2 cere o delogare explicită care chiar funcționează, nu managementul sesiunilor.

Ruta rămâne `@Public()`: un tab cu sesiunea deja expirată trebuie să se poată deloga. Citește
cookie-ul „pe cât se poate" — un token care nu se verifică pur și simplu n-are ce revoca.

### D24 — Parametrul `state` la OAuth, într-un cookie propriu
Fără el, callback-ul acceptă orice cod de autorizare care ajunge la el. Un atacator parcurge
fluxul Google cu contul lui, se oprește înainte de ultimul redirect și determină browserul
victimei să viziteze callback-ul cu acel cod: victima e autentificată în tăcere **ca atacatorul**,
iar cărțile pe care le adaugă ajung în biblioteca lui. Nimic nu pare stricat, și tocmai de-asta
merită apărat.

Se generează un nonce la pornirea fluxului, se trimite la Google ca să fie returnat identic, și
se ține între timp într-un cookie `httpOnly` cu viață scurtă, limitat la `/auth`. Callback-ul
compară cele două **înainte** să ruleze passport, deci un callback falsificat e refuzat fără ca
codul lui să fie vreodată schimbat cu Google. Cookie-ul se șterge în ambele cazuri: nonce-ul e
de unică folosință.

Passport știe să facă asta singur, dar numai printr-un session store, iar §D20 rulează passport
cu `session: false` — sesiunea *e* cookie-ul JWT. De aceea nonce-ul primește un cookie al lui.

### D25 — S4.4 se elimină: nu există reîmprospătare
S4.4 cerea ca un câmp editat manual să fie marcat și să nu mai fie suprascris „de o eventuală
reîmprospătare ulterioară a datelor externe".

Partea de story era deja livrată de S1.3 — orice câmp e editabil oricând, indiferent de sursa
care l-a populat. Iar reîmprospătarea nu există: niciun story din Sprinturile 0–8 sau din
backlogul opțional nu recitește datele unei cărți din Open Library. Coloana s-ar fi scris la
fiecare editare și nu s-ar fi citit niciodată.

**Decizie:** story-ul se taie, nu se amână, iar `manuallyEditedFields` iese din schemă. Dacă
apare vreodată un story de refresh, se reintroduce împreună cu el — atunci va avea un cititor.

### D26 — Coperta e `immutable`, deci URL-ul poartă o versiune
§D18 servește coperta cu `Cache-Control: max-age=1 an, immutable`, pe premisa că nu se schimbă
niciodată după adăugare. Upload-ul manual din S4.3 e exact premisa aceea căzând: la înlocuirea
unei coperți, browserul — respectând corect `immutable` — ar păstra imaginea veche un an.

**Decizie:** `Cover.updatedAt` intră în URL ca `?v=`, iar `Book.coverUrl` îl livrează gata
compus. O copertă înlocuită devine astfel pur și simplu un URL pe care cache-ul nu l-a văzut
niciodată. Alternativa — slăbirea cache-ului pentru toată lumea — ar plăti pentru un caz care
apare cel mult o dată per carte.

Consecință: clientul nu construiește niciodată URL-ul coperții singur. Îl ia din `coverUrl`,
altfel versiunea e primul lucru care se pierde.

### D27 — Erorile se împart după ce poate face utilizatorul, nu după a cui e vina
Convenția exista în practică, dar nescrisă: aproape toate erorile acționabile aveau deja
mesaj în română, iar erorile interne ajungeau 500 generic — dar pentru că așa face Nest din
oficiu, nu pentru că ar fi decis cineva. Nu exista niciun cod de eroare nicăieri, iar clientul
ramifica pe status HTTP.

**Decizie.** O singură întrebare împarte erorile: *poate utilizatorul face ceva în privința
asta?*

- **Da** → `AppError` pe server: o propoziție scrisă pentru el, plus un `code` din lista din
  `shared/errors.ts`. Mesajul se afișează verbatim; codul e pentru clientul care trebuie să
  **ramifice**, nu doar să afișeze.
- **Nu** → `Error` obișnuit. Filtrul global îl transformă în 500 gol: fără cod, fără mesaj,
  fără nimic despre interiorul serverului.

**Codul e discriminatorul, nu statusul.** Asta e tot rostul lui. Alternativa evidentă —
„arată mesajul dacă statusul e sub 500" — e greșită într-un fel ușor de ratat: **statusurile
HTTP răspund la «a cui e vina», iar convenția asta întreabă «ce poate face utilizatorul»**.
Cele două întrebări dau răspunsuri diferite exact pentru o indisponibilitate externă, care nu
e vina clientului (deci 5xx) dar e complet acționabilă („Open Library e picat, scrie tu
cartea"). Cu regula pe status, fix acel mesaj se pierde — și chiar s-a pierdut: în Sprint 4
mesajul de 503 al backendului n-a ajuns niciodată la utilizator, iar cele două componente au
ajuns să-și scrie propriile variante ale aceleiași propoziții.

**Filtrul aplică regula, nu doar o documentează.** `AppExceptionFilter` rescrie orice 5xx
**fără cod**, oricât de vorbăreț ar fi. Nimic din TypeScript nu împiedică
`new InternalServerErrorException(err.message)`, iar fără filtru Nest ar pune fidel părerea
driverului despre string-ul de conexiune pe ecranul cuiva. Convenția nu se mai poate încălca
în tăcere — doar deliberat, aruncând un `AppError`.

Consecințe:
- 429 primește cod aici (`ThrottlerException` vine din bibliotecă, deci n-are cum să-l aducă
  singur), la fel și 401 — ridicat de passport și de guard-urile Nest, niciodată de codul
  nostru.
- Clientul a scăpat de toate ramificările pe status: `errorMessage(error, fallback)` decide
  o singură dată, iar componenta dă doar propoziția pentru cazul fără cuvinte proprii (eroare
  de rețea, care n-a ajuns niciodată la API).
- Un cod necunoscut e ignorat la citire. Vine de pe rețea; nu se promovează singur în „serverul
  zice că se poate afișa".

### D28 — Galeria e o rută proprie, nu un comutator de vedere peste tabel

Sprint 5 cere „toate cărțile ca grid de coperți" (S5.1), dar niciun story nu spunea *unde*:
un comutator tabel/grilă pe `/`, o rută separată, sau o înlocuire a tabelului.

**Decizie: rută proprie, `/gallery`.** Răspunsul era deja în produs — bara de navigație
poartă din Sprint 1 toate cele șase destinații (`Bibliotecă`, `Galerie`, `Tracker`,
`Wishlist`, `Buget`, `Statistici`), cele neconstruite fiind gri, fără `to`. Sprint 5 e
sprintul care aprinde `Galerie`; a o transforma într-un comutator ar goli o intrare pe care
utilizatorul o vede de la prima autentificare.

Consecințe:
- Tabelul de la S1.2 rămâne neatins pe `/`. Grila nu-l înlocuiește și nu-l dublează:
  sunt două suprafețe cu rosturi diferite — una de citit în detaliu, una de recunoscut vizual.
- Calea e engleză (`/gallery`), eticheta e română (§D21), exact ca `/wishlist`.
- Aceeași regulă rezolvă și sprinturile următoare: `Buget` → `/budget` (Sprint 6),
  `Statistici` → `/stats` (Sprint 7). Nu mai e o întrebare deschisă la începutul fiecărui
  sprint.
- Grila **nu** primește control de sortare: S1.2 deține explicit „tabelul e sortabil", iar
  S5.1/S5.3 nu cer așa ceva. Ordinea implicită (`createdAt desc`) e suficientă.

### D29 — Filtrele galeriei sunt server-side, pe aceeași rută de listare

S5.3 cere filtre combinabile după status (selecție multiplă), gen și favorite. Ruta de
listare accepta un singur status opțional, iar tentația evidentă era un `filter()` în client,
peste lista deja încărcată.

**Decizie: filtrele intră în `GET /books`, server-side**, din același motiv scris la S3.1 —
o listă filtrată după o altă regulă decât totalurile afișate lângă ea e felul în care cele
două încetează în tăcere să mai fie de acord.

- **`status` acceptă mai multe valori**, ca parametru repetat (`?status=READING&status=FINISHED`).
  O singură valoare rămâne validă, deci wishlist-ul (S3.1) nu se schimbă deloc.
- **`genre` e o singură valoare**, fiindcă o carte are un singur gen (§D17). Un filtru
  multi-valoare ar sugera un model de date care nu există.
- **`favorite` filtrează pe valoarea flagului.** Interfața trimite doar `true` („doar
  favoritele"), dar `false` e acceptat și înseamnă ce scrie.
- Absent = fără filtru. Un filtru golit de utilizator nu trimite parametrul, deci nu există
  cazul „listă goală fiindcă n-ai bifat nimic".

Filtrele galeriei nu ating wishlist-ul: `/wishlist` e o rută cu statusul fixat, nu o vedere
filtrabilă, iar §D14 rămâne valabil — favorit se combină liber cu orice status, inclusiv cu
o carte încă necumpărată.

**Starea goală e a filtrelor, nu a bibliotecii.** „Încă n-ai nicio carte" e un mesaj greșit
când biblioteca e plină și doar filtrele sunt prea înguste; sunt două stări goale distincte,
a doua cu o cale de întoarcere (resetarea filtrelor).

### D30 — `favorite` devine scriptibil prin ruta de editare, fără rută proprie

S5.2 e prima poveste care scrie coloana `favorite`, existentă din prima migrare și returnată
la citire de la bun început (o cerere care încerca s-o seteze era respinsă explicit, nu
ignorată în tăcere).

**Decizie:** câmpul intră în schema de scriere, ca `estimatedPrice` în S3.2. Fără
`PUT /books/:id/favorite`: o steluță e o editare ca oricare alta, iar rândurile din tabel
declanșează deja mutații direct (schimbarea de status, „Am cumpărat-o"). O rută proprie ar
adăuga un al doilea fel de a scrie o coloană, fără să câștige nimic.

Marcajul se pune de pe cardul din galerie, unde DESIGN.md îl așază (colț dreapta-sus, peste
copertă). Tabelul nu primește coloană de favorit: lista de coloane din S1.2 nu o conține.

### D31 — Bugetul e lunar, iar S6.4 nu se implementează

Story-ul S6.3 cerea „buget lunar **sau** anual", iar tabelul are de la prima migrare două
coloane. Ce însemna „cât mai am disponibil" când sunt setate amândouă n-a spus nimeni
niciodată — și nici care dintre ele semnalează depășirea.

**Decizie: bugetul e lunar.** O singură limită, o singură fereastră, o singură cifră de
citit. `yearlyBudget` rămâne coloană nefolosită, ca și `currency` după scoaterea S6.4:
migrarea există deja, iar ziua în care un story le cere sunt acolo. Niciuna nu apare în DTO —
un câmp expus pe care nu-l onorează nimeni e mai rău decât unul absent.

**Ce înseamnă „disponibil".** `buget − cheltuit în luna curentă`, fără report (§D9): fiecare
lună pornește de la bugetul întreg, iar economia lunii trecute nu se adună. Cifra **devine
negativă** la depășire, fiindcă semnul e exact semnalul cerut de S6.3; oprită la zero, s-ar
pierde singurul caz care merita afișat. Depășirea rămâne strict vizuală — nu blochează nimic.

**Banii fără dată sunt bani la fel.** O carte cumpărată înainte să existe aplicația se
introduce direct ca `Terminat`, iar `purchasedOn` se stampilează doar la tranziția în
`Cumpărat` (S1.5) — deci pentru cine își introduce biblioteca existentă, „preț plătit, fără
dată" e cazul obișnuit, nu excepția. Regula:

- intră în totalul de la S6.1;
- nu intră în nicio lună, deci nici în grafic (S6.2) și nici în cifra lunii (S6.3);
- **ambele suprafețe raportează diferența**, cu număr de cărți *și* sumă. Numărul singur
  lasă cititorul să scadă două totaluri în cap.

**Graficul e dens.** Lunile fără cumpărături apar cu zero, de la prima cumpărare datată până
la luna curentă. Fără ele, ianuarie ar sta lângă aprilie la lățime egală, iar axa ar înceta să
mai fie timp. O bibliotecă fără nicio cumpărare datată dă o serie goală, nu o bară de zero.

**Un singur răspuns pentru S6.1 și S6.3.** `GET /budget/summary` le duce pe amândouă, fiindcă
sunt același ecran: două cereri separate pot pica de o parte și de alta a miezului nopții
dintre 31 și 1, iar pagina ar afișa două luni diferite fără să știe.

### D32 — Unde stau dashboard-ul și raftul, și ce era „Tracker"

§D28 a rezolvat locul galeriei, al bugetului și al statisticilor, dar a lăsat neatinsă a șasea
intrare din navigație — `Tracker` — gri din Sprint 1. Sprintul 8 e ultimul, deci e ultima
ocazie s-o aprindă. Între timp, S8.1 cere cifrele „la deschiderea aplicației", iar §D28 spune
în litere că tabelul de la S1.2 **rămâne neatins pe `/`**. Cele două citite laolaltă păreau să
se contrazică.

Nu se contrazic: „la deschidere" e o cerință despre *ecranul de start*, nu despre înlocuirea
lui.

**Decizie, în trei părți.**

1. **Cifrele stau sus pe `/`, deasupra tabelului.** Nu o rută proprie: o pagină de dashboard
   pe care trebuie să navighezi nu mai e „la deschiderea aplicației", e încă un ecran. Banda
   ia locul salutului generic care era acolo — care oricum spunea mai puțin decât patru cifre.
   §D28 rămâne intact: tabelul nu e nici înlocuit, nici dublat.
2. **Raftul primește a șasea intrare, `/shelf`, cu eticheta `Raft`.** Nu „Tracker": niciun
   story din backlog n-a livrat vreodată un lucru numit așa, iar USER_STORIES.md folosește
   cuvântul pentru aplicația întreagă („un tracker de cărți complet funcțional", livrabilul
   Sprintului 1), nu pentru un ecran. Eticheta a fost dintotdeauna un loc gol care aștepta un
   nume; S8.2 e story-ul care i-l dă. Calea în engleză, eticheta în română (§D21), ca peste
   tot.
3. **Raftul nu stă pe `/`.** E o suprafață deschisă la culoare, singura din aplicație
   (DESIGN.md §Raftul), și funcționează prin contrast — lipită deasupra unui tabel, ar fi doar
   o bandă luminoasă în mijlocul unui ecran întunecat.

**Consecință asupra cifrelor.** S8.1 numește exact patru: cărți citite, în curs, pagini citite
și *cheltuit luna asta*. Ultima nu vine din `/stats/overview`, ci din `/budget/summary` — care
o calculează deja pentru S6.3. Dashboard-ul face deci două cereri, iar criteriul „același
endpoint ca pagina de statistici" se referă la metricile de lectură, singurele care s-ar fi
putut dubla. Ratingul mediu **nu** e pe dashboard: e a treia cifră a lui S7.1 și rămâne pe
`/stats`.

### D33 — Geometria cotorului: intervalul din DESIGN.md, dar altfel calculat

Prototipul raftului și DESIGN.md §Raftul dădeau numere diferite (20–56px față de 14–44px,
implicit 32 față de 24). Verificate, amândouă erau greșite, fiecare în felul ei — și nu din
cauza intervalului, ci a formulei.

**Regula moartă din prototip.** Titlul rotit se afișa „doar când grosimea depășește 20px", dar
grosimea minimă *era* 20px: condiția nu putea fi falsă niciodată. O regulă care nu se aplică
nu e o regulă, e cod care induce în eroare.

**Regula moartă din spec.** Grosimea se calcula proporțional cu `totalPages / 750`, pornind de
la zero pagini. Dar zero pagini nu există — o carte fără număr de pagini primește grosimea
implicită (§D4) — așa că o carte de 200 de pagini ieșea deja la 22px, iar capătul de jos al
intervalului era la fel de inaccesibil ca cel de sus.

**Decizie:** se păstrează intervalul din DESIGN.md — **14–44px, implicit 24px, titlul peste
20px** — și se schimbă maparea: `[80, 900] pagini → [14, 44]px`, cu tăiere la capete. O carte
subțire chiar ajunge la 14px și chiar își pierde titlul; una de 900 de pagini chiar atinge
44px. Ambele capete devin atinse de cărți reale, iar condiția titlului redevine o condiție.

Intervalul specului câștigă și pe fond, nu doar fiindcă e specul: e singurul dintre cele două
în care pragul de 20px cade *înăuntru*.

---

### D34 — Tabelul de cărți: coloane fixe, iar sub `xl` nu mai e tabel

Tabelul din S1.2 avea `w-full min-w-[860px]` într-un container cu `max-lg:overflow-x-auto`, și
asta producea două defecte diferite, în două locuri diferite.

Pe desktop, lățimea *min-content* a tabelului — 1151px, impusă de nouă anteturi `nowrap` și de
celula de acțiuni — depășea `w-full`, deci tabelul ieșea din cardul care îl încadra: liniile de
rând treceau cu ~48px dincolo de bordura din dreapta a cardului. Trei muchii diferite pe același
tabel. Pe telefon se vedeau trei coloane și jumătate, statusul și toate acțiunile cereau scroll
orizontal, iar antetul `sticky top-16` își măsura offsetul față de containerul de scroll în loc
de viewport și se așeza peste primul rând.

**Decizie:** `table-fixed`, cu lățimile declarate o dată într-un `<colgroup>` și **măsurate**,
nu estimate — fiecare coloană cât îi cere cea mai lată celulă reală, cu titlul absorbind restul.
Tabelul nu mai poate fi mai lat decât cadrul lui, deci containerul de scroll dispare cu totul, și
odată cu el defectul antetului lipicios.

Sub `xl`, aceleași rânduri se desenează ca **fișe**, nu ca un tabel îngustat. Nouă coloane n-au
ce căuta pe 390px, iar alternativa — scroll orizontal — ascunde exact ce contează. Cele două
variante se exclud în JavaScript (`useMediaQuery`), nu prin `display: none`: ambele randate ar
pune fiecare carte de două ori în arborele de accesibilitate. Interogarea e scrisă ca *narrow*
tocmai pentru ca „nu se potrivește" — cazul jsdom, unde nu există `matchMedia` — să însemne
tabelul complet.

Sortarea primește o bandă proprie deasupra fișelor. Fără antet n-are unde locui, iar S1.2 nu
spune „sortabil pe desktop".

### D35 — Șasiul trece la `max-w-7xl`

Consecința directă a lui §D34: la `max-w-6xl` (1152px minus gutter, deci ~1104px utilizabili),
nouă coloane pur și simplu **nu încap** — suma lățimilor măsurate era 1181px. Alternativele erau
să ciuntim patru celule deodată (bara de progres, data, ratingul, butoanele de acțiune), fiecare
cu propria pierdere de lizibilitate.

**Decizie:** șasiul aplicației trece la `max-w-7xl`, peste tot — header inclusiv, altfel bara de
sus și conținutul nu se mai aliniază. Tabelul primește 1230px și încape fără să schimbăm nimic
din ce e *în* celule. „Densitate mică" din DESIGN.md rămâne intactă: marginile și spațierea nu se
schimbă, doar plafonul.

### D36 — Cursorul e o regulă, nu o clasă pusă din când în când

Browserele desenează `<button>` cu săgeata obișnuită, iar preflight-ul Tailwind nu intervine. În
practică două elemente din toată aplicația își asumau `cursor-pointer` — cotorul din raft și
stelele de rating — și încă vreo patruzeci de butoane identice, nu.

**Decizie:** o singură regulă în `@layer base`, iar clasele per-componentă se șterg. Citirea e:
**pointer** = un clic aici face ceva · **not-allowed** = e un control, dar e oprit · **text** =
poți selecta sau scrie (implicitul browserului, neatins) · **default** = e o suprafață.

`select` intră la pointer: un select închis e un lucru pe care îl apeși ca să se deschidă,
indiferent ce spune cursorul lui nativ. `span[aria-disabled]` din nav rămâne la `default` —
înseamnă „încă n-are unde duce", iar „interzis" e o afirmație mai tare decât atât.

### D37 — Interfața pentru Kobo e un al doilea frontend, pe același domeniu, ales după User-Agent

Browserul unui Kobo Libra Colour e un WebKit vechi de peste zece ani. Aplicația existentă —
React 19, react-router, TanStack Query, Recharts, Tailwind 4 — nu se degradează acolo, ci nu
pornește deloc: Tailwind 4 își construiește tot sistemul pe proprietăți personalizate și
`oklch()`, iar bundle-ul e JS modern. Nu e o problemă de stilizare, deci nu se rezolvă
stilizând.

**Decizie:** un al patrulea workspace, `kobo-frontend/`, Express cu HTML randat pe server și
zero JavaScript de client. Amendează §D22: structura devine `shared/`, `backend/`, `frontend/`,
`kobo-frontend/`.

**Express, nu Nest.** Nest merită prețul acolo unde există un strat de servicii cu dependențe
de injectat. Aici nu există: workspace-ul randează și atât, iar datele vin de la API.

**Un singur domeniu.** Cookie-ul de sesiune se pune fără atributul `Domain`
(`backend/src/auth/session.ts`), deci e *host-only* — un al doilea nume de gazdă n-ar primi
nicio sesiune. Aceeași origine înseamnă zero modificări la cookie și la CORS-ul din §D20.

**Alegerea se face după User-Agent, nu după prefix de rută.** Un prefix `/kobo/*` ar fi fost mai
simplu de rutat, dar ar fi rupt legăturile dintre cele două interfețe: aceeași carte ar fi avut
două URL-uri. Prețul e că regula se scrie de două ori — în `kobo-frontend/src/lib/ui-choice.ts`
și ca blocuri `map` în `docker/kobo-routing.conf` — fiindcă decizia trebuie luată înainte ca
cererea să ajungă la vreuna dintre aplicații, iar acolo e doar proxy-ul.

**Cookie-ul `ui` bate User-Agent-ul.** Fără portiță de ieșire, interfața lite ar fi accesibilă
exclusiv de pe dispozitivul care produce șirul potrivit: nedezvoltabilă și netestabilă.
`/ui/lite`, `/ui/full` și `/ui/auto` merg întotdeauna la aplicația Kobo, altfel portița s-ar
încuia pe dinăuntru.

**`Vary: User-Agent, Cookie` e obligatoriu.** Două documente diferite răspund la același URL.
Un cache care ignoră asta servește mai devreme sau mai târziu shell-ul React unui e-reader,
adică exact eșecul pe care tot aranjamentul îl evită.

**Regula de conținut:** `kobo-frontend/` nu are logică de business. Orice îi trebuie calculat
vine din API sau din `shared/`. Altfel cele două frontend-uri o iau razna fiecare în direcția
lui, iar `progress.ts` — al cărui comentariu spune explicit că există ca formularea să nu difere
între suprafețe — ar fi primul care se dublează.

Sistemul de design al suprafeței e în `docs/kobo_design.md` — inclusiv de ce tema închisă se
inversează acolo și nicăieri altundeva.

**Ce nu s-a decis încă.** Ce poate face motorul aflăm de la `/probe`, nu dintr-o presupunere:
niciun tabel public de User-Agent nu trece de dispozitive din 2012. Autentificarea rămâne
deschisă — Google refuză consimțământul în browsere pe care le consideră nesigure, deci pe
dispozitiv va trebui o împerechere prin cod, nu fluxul OAuth obișnuit.

### D38 — Impersonarea admin refolosește sesiunea, nu e un ecran separat de „vezi ca"

Un admin trebuie să poată prelua sesiunea unui alt cont, pentru suport/depanare, fără ca vreun
cont să poată fi vândut sau autohostat pentru profit de altcineva decât proprietarul instanței —
asta rămâne o chestiune de licență (LICENSE), nu de cod.

**Decizie: token-ul de sesiune existent, nu un mecanism separat.** `sub` din JWT devine
id-ul contului țintă, deci fiecare verificare `@CurrentUser()`/de proprietate din aplicație
continuă să funcționeze neschimbată — nu există un „mod vizualizare" paralel de întreținut.
Identitatea adminului călătorește totuși în același token (`impersonatorId`/`impersonatorEmail`,
`auth.service.ts`), ca `JwtStrategy.validate` să o poată atașa la `AuthUser.impersonatedBy` fără
un al doilea SELECT pe fiecare cerere — cheltuiala aceea s-ar repeta la fiecare request cât
durează impersonarea, nu doar o dată, la începutul ei.

**`isAdmin` e un flag persistat, setat direct în rând, nu dintr-un ecran de administrare.** A fost
cerută explicit o soluție fără UI de gestionare a rolurilor: promovarea se face editând coloana
în bază, iar `AuthController` o citește de acolo. Login-ul **nu** o atinge — un `create` ia
`@default(false)`, iar orice autentificare ulterioară lasă neatins ce e stocat.

O versiune anterioară o recalcula la fiecare login dintr-o variabilă de mediu `ADMIN_EMAILS`
(listă separată prin virgulă). Asta o făcea, în practică, o stare *derivată* dar totuși
persistată — cel mai prost din ambele lumi: primul login de după un deploy care omitea variabila
o rescria tăcut pe `false`, demovând adminul fără nicio eroare. Sursa de adevăr fiind acum rândul,
iar login-ul nemaifiind un al doilea scriitor, flag-ul se schimbă doar când e schimbat rândul —
nimic din login sau deploy nu-l mai poate reseta. `ADMIN_EMAILS` a fost eliminată cu totul.

**Auditul e o linie de log, nu un tabel.** `AuthController` scrie cu `Logger.warn` la începutul
și la sfârșitul unei impersonări — cine, pe cine. Un tabel persistent ar fi fost interogabil mai
târziu, dar ar fi prima entitate din schemă a cărei singură treabă e „cine a văzut datele cui",
cerință care nu există încă altundeva în aplicație.

**Admin poate impersona alt admin.** Nu există o interdicție admin-pe-admin: singura restricție
e auto-impersonarea (400 direct în `AuthController.impersonate`), care n-ar face nimic decât să
încurce contul propriu.

### D39 — Lista de genuri devine o listă de 29 de categorii, sub același identificator

Lista din §D17 era o taxonomie literară (SF, Fantasy, Thriller...), gândită pentru o bibliotecă
de ficțiune. Cererea de a acoperi un raft real — culinar, tehnic, juridic, hărți turistice —
i-a depășit forma: o listă de 17 valori literare nu are unde să pună o carte de drept sau un
atlas.

**Decizie: lista devine cele 29 de categorii ale unei librării reale**, înlocuind complet lista
veche (nu o extinde — vezi maparea de mai jos). Structura din §D17/§D19 rămâne: o valoare per
carte, listă fixă în cod/schemă, fără story de administrare.

**Identificatorul rămâne `genre`/`Genre` în cod și în schemă**, chiar dacă eticheta din interfață
devine „categorie". Un redenumire completă a coloanei, a tipului și a fiecărei referințe din
`shared/`, backend, ambele frontend-uri și MCP nu cumpăra nimic ce cititorul unui `GENRE_LABEL`
nu vede deja — era zgomot de refactorizare fără o problemă reală în spate.

**Datele existente sunt mapate, nu golite.** Valoarea nu doar crește, ci se înlocuiește — deci
o migrare simplă `ALTER ... MODIFY COLUMN` ar fi trunchiat orice rând cu o valoare veche la
șirul gol (comportamentul MySQL pentru o valoare ENUM care nu mai există în listă), o eroare
tăcută mai rea decât oricare din cele două alternative reale. Migrarea lărgește întâi coloana la
text simplu, rescrie fiecare cod vechi cu un `UPDATE ... CASE`, apoi îngustează la noul ENUM:

`FICTION`/`SCIFI`/`FANTASY`/`THRILLER`/`ROMANCE` → `FICTION` (toate subgenurile de ficțiune
colapsează în singura categorie de ficțiune a listei noi) · `HISTORICAL` → `HISTORY` ·
`MEMOIR` → `BIOGRAPHIES` · `SELF_HELP` → `HEALTH_SELF_DEVELOPMENT` · `BUSINESS` →
`BUSINESS_ECONOMY` · `SCIENCE` → `EXACT_SCIENCES_MATH` · `PHILOSOPHY`, `PSYCHOLOGY` →
neschimbate · `POETRY` → `POETRY_THEATRE` · `COMICS_MANGA` → `COMICS` · `NONFICTION`,
`CHILDREN_YA`, `OTHER` → `NULL` (nicio categorie din lista nouă nu acoperă ce însemnau; a le
forța pe una anume ar fi greșit clasificarea, nu doar ar fi lăsat-o nesetată).

**Selectorul devine căutabil** în cele două suprafețe React (formularul de adăugare/editare și
filtrul galeriei) — 29 de opțiuni nu se mai scanează cu ochiul la fel de repede ca 17. kobo-frontend
rămâne un `<select>` simplu: nu există încă un pattern de combobox pe acea suprafață, iar un
`<select>` nativ cu 29 de opțiuni tot scrolează rezonabil pe un ecran fără hover.

Lista, în ordinea din schemă (identificator → etichetă afișată):

`AUDIOBOOKS` → Audiobooks · `CULINARY` → Culinare · `ART_ARCHITECTURE` → Artă, arhitectură ·
`ENCYCLOPEDIAS` → Enciclopedii · `BIOGRAPHIES` → Biografii, memorii, jurnale ·
`LINGUISTICS_DICTIONARIES` → Lingvistică, dicționare · `ROMANIAN_MAGAZINES` → Reviste - Limba
română · `FOREIGN_LANGUAGES` → Limbi străine · `POETRY_THEATRE` → Poezie, teatru, studii
literare · `FICTION` → Ficțiune · `COMICS` → Benzi desenate · `TRAVEL_GUIDES` → Ghiduri și hărți
turistice, atlase · `HISTORY` → Istorie · `RELIGION` → Religie · `PHILOSOPHY` → Filosofie ·
`PSYCHOLOGY` → Psihologie · `SOCIAL_SCIENCES_POLITICS` → Științe sociale. Politică ·
`MARKETING_COMMUNICATION` → Marketing și comunicare · `BUSINESS_ECONOMY` → Business și economie ·
`LAW` → Drept · `MEDICINE` → Medicină · `EXACT_SCIENCES_MATH` → Științe exacte. Matematici ·
`NATURE_ENVIRONMENT` → Natură și mediu · `TECHNOLOGY` → Tehnică și tehnologie ·
`COMPUTERS_INTERNET` → Computere și internet · `HEALTH_SELF_DEVELOPMENT` → Sănătate, dezvoltare
personală · `LIFESTYLE_SPORT_LEISURE` → Lifestyle, sport, timp liber · `ROMANIA` → România ·
`EDUCATIONAL_SOFTWARE` → Soft educațional

### D40 — Cartea capătă o descriere, iar sursa ei e Claude prin MCP, nu bookcsi

Cererea are două jumătăți care se citesc ca una singură: „o fișă a cărții (toate detaliile plus
descrierea ei)" și „aș vrea ca Claudiu să poată să ia descrierile de pe net și să mi le adauge".
A doua e cea care decide arhitectura.

**Decizie: `Book` primește o coloană `description` (TEXT, plafonată la 5000 de caractere), și
atât.** Nicio integrare de căutare pe web în bookcsi, niciun scraper, nicio preluare automată
din Open Library. Coloana e text obișnuit, editabil de utilizator — iar asistentul care o
completează o scrie prin `update_book`, unealta MCP care exista deja. Modelul are deja acces la
web de partea lui; bookcsi n-are ce adăuga acolo decât o a doua sursă de bug-uri și o cheie de
API în plus.

Consecința care merită spusă: **nu se reține de unde a venit o descriere.** Nici `descriptionSource`,
nici o marcă „scris de AI". Ar fi un câmp pe care nimic din aplicație nu-l citește, și ar sugera
o distincție care nu există — o descriere scrisă de Claude și corectată apoi de utilizator în
formular n-ar mai avea un răspuns adevărat.

**Plafonul de 5000 de caractere e o decizie despre MCP, nu despre baza de date.** Coloana e TEXT
(64KB); limita e în `createBookSchema`. Motivul e `get_book`, care întoarce cartea întreagă unui
model: o coloană nemărginită ar fi un câmp prin care o carte poate consuma oricât din contextul
conversației. Din același motiv `search_library` **nu** întoarce descrierea — rândul lui rămâne
cel subțire de la §MCP.md §8, fiindcă „ce cărți am" nu e o întrebare la care se răspunde cu
douăzeci de sinopsisuri.

Descrierea nu apare nici pe Kobo deocamdată. Ecranul e e-ink și nu are voie să scroleze
(`kobo_design.md`), iar un text de lungime arbitrară e exact problema pe care regula aia o
interzice — e o decizie de design proprie, nu o consecință a acesteia.

### D41 — Cartea capătă un ecran propriu, iar „înapoi" ține minte de unde s-a venit

§S8.2 spunea că „detaliile cărții sunt un singur ecran în aplicație", iar acel ecran era
`BookFormDialog`. Descrierea din §D40 rupe asumpția: un sinopsis de câteva paragrafe într-un
`<textarea>`, între ISBN și numărul de pagini, e text pe care trebuie să intri în modul de
editare ca să-l citești.

**Decizie: `/books/:id` devine ecranul de citit, iar dialogul rămâne ecranul de scris.** Titlul
dintr-un rând, cardul din galerie, cotorul de pe raft și rândul dintr-o provocare duc toate
acolo; creionul de lângă titlu deschide în continuare formularul, iar de pe fișă se ajunge la el
cu un buton. Împărțirea e pe ce faci, nu pe ce vezi — înainte de fișă cele două erau
obligatoriu același click, fiindcă nu exista un al doilea loc unde să te duci.

**Butonul „înapoi" nu e `navigate(-1)`.** O carte se deschide din cinci ecrane și din niciunul:
un link lipit în chat, un bookmark, un F5 pe fișa însăși. `navigate(-1)` merge prin istoricul
browserului, nu prin structura aplicației, deci exact cazurile fără intrare de istoric —
linkul rece și reîncărcarea — scot utilizatorul din bookcsi. Și nu se poate eticheta: un buton
care nu știe unde merge poate desena doar o săgeată.

Așa că **originea călătorește cu navigarea**, în `state`-ul intrării de istoric: ecranul care
deschide cartea își scrie acolo calea și numele („galerie", „raft", „provocare"). Supraviețuiește
unui reload, fiindcă browserul persistă `history.state`, și e ceea ce transformă „←" în „← Înapoi
la raft". Când nu există stare — sosirea cu adevărat rece — se cade pe ecranul căruia îi
aparține cartea: wishlist pentru o carte de pe wishlist, biblioteca pentru restul.

Starea e **parsată, nu presupusă**. E scriabilă din consolă și poate supraviețui formei care a
scris-o, iar o cale absolută în spatele unui buton scris „înapoi" e un open redirect cu o vorbă
prietenoasă pe el — aceeași regulă pe care `return-to.ts` o aplică deja căii de după login.

### D42 — Căutarea e un parametru pe ruta de listare, nu o rută și nu un `filter()` în client

S10.1 cere căutare în bibliotecă. Există deja un drum pentru asta: §D29 a stabilit, pentru
filtrele galeriei, că o listă se restrânge **în SQL, pe ruta care o listează**. Căutarea e încă un
predicat pe același `where`.

**Decizie: `?q=` pe `GET /books`.** Fără rută proprie, fără endpoint de „search", fără index
full-text. Consecința e că orice ecran care listează cărți poate căuta fără cod de server nou —
tabelul, galeria, wishlist-ul și selectorul provocărilor o fac deja, iar `search_library` prin MCP
primește exact același parametru.

**Cinci câmpuri: titlu, autor, editură, ISBN, descriere.** Primele patru sunt felul în care
recunoști o carte. `description` e inclusă la cerere explicită, și e singura care lărgește *ce
înseamnă* o potrivire: e proză (până la 5000 de caractere, §D40), deci o căutare de „tehnologie"
întoarce și cartea al cărei sinopsis spune că **nu** e despre tehnologie, fără ca rândul să arate
de ce s-a potrivit. E un compromis acceptat, scris aici ca să nu fie redescoperit ca bug.

**Mai multe cuvinte: `AND` de `OR`-uri.** Fiecare cuvânt trebuie să apară în *vreunul* din cele
cinci câmpuri, nu toate în același: așa „herbert dune" găsește cartea cu un cuvânt în autor și
celălalt în titlu. Cuibărirea inversă (`OR` de `AND`-uri) ar face lista să *crească* pe măsură ce
utilizatorul tastează mai mult din ce caută — exact opusul a ceea ce înseamnă să cauți.

**Majusculele și diacriticele nu se tratează în cod.** Baza rulează pe `utf8mb4_unicode_ci`
(fixat în `docker-compose.yml` pentru altă problemă, cu ani înainte de acest story), care pliază
ambele: `'ă' = 'a'` și `'Ș' = 's'` sunt adevărate în SQL. Deci `contains` e de la sine
insensibil la ambele, fără coloană normalizată. **`mode: "insensitive"` nu se adaugă:** e o
facilitate Postgres, nesuportată pe MySQL/MariaDB — colația face deja treaba.

**`%` și `_` rămân neescapate**, prin decizie. Prisma parametrizează valoarea, deci nu e o
injecție, doar un utilizator care tastează un wildcard și primește un wildcard.

**ISBN-ul se caută așa cum e stocat.** Coloana păstrează punctuația tastată (§D13 normalizează
doar pentru verificarea de duplicate), deci „978-606" găsește rândurile cu cratime și „978606" pe
cele fără. A le uni ar cere `REPLACE()` în SQL brut, neindexat, pentru un câmp pe care oricum
puțini îl caută.

**Fără index, și fără regrete.** `LIKE '%…%'` e scanare de tabel, iar tabelul e biblioteca *unui*
utilizator — sute de rânduri, poate mii. Un index full-text ar schimba și semantica (potrivire pe
prefix de cuvânt, nu pe subșir), adică ar strica „caută în timp ce tastez".

**Ce a atras căutarea după ea, în cod:**

- **Sortarea nu mai reconstruiește interogarea din două câmpuri.** `BookTable` trimitea
  `{ sort, order }`, aruncând restul. Nu se vedea, fiindcă singurul ecran cu filtre (galeria) nu
  are control de sortare; cu o casetă de căutare peste tabel, un click pe „Titlu" ar fi șters ce
  tastase utilizatorul. Acum trimite `{ ...query, sort, order }`.
- **Golul are două înțelesuri.** O bibliotecă goală vrea o primă carte; o căutare fără rezultate
  vrea cuvintele înapoi. `isFiltered` numără și căutarea, iar mesajul „nicio carte nu se
  potrivește" (mutat din `GalleryPage` în `NoMatches`) e acum pe toate trei ecranele.
- **Fraza de sub titlul bibliotecii tace cât se caută.** Număra rândurile de pe ecran, care sub o
  căutare sunt rezultatele, nu biblioteca — „ai o carte începută" ar fi devenit un fapt despre
  altă mulțime.
- **Selectorul de cărți al provocărilor a trecut pe server.** Făcea `title || author` cu
  `toLowerCase()`, care pliază majuscule dar **nu** diacritice: ar fi rămas singurul loc din
  aplicație care nu găsește „Șarpe" după „sarpe".

**Totalul wishlist-ului rămâne global**, la cerere: e suma întregului wishlist, nu a rezultatelor.
Asta e exact dezacordul de care §D29 se ferea, așa că ecranul îl **spune** — sub total apare un
rând care precizează că e pentru tot wishlist-ul, dar numai cât timp se caută.

**Kobo nu primește căutare acum.** Interfața aceea e HTML server-side fără JS de filtrare, deci ar
cere un `<form method="get">`, un parametru dus prin rută și paginare resetată — dar mai ales ar
cheltui din bugetul de rânduri pe care `pagination.ts` îl ține ca pagina să încapă fără scroll pe
un e-reader. Rămâne un story separat.

**Raftul nu primește căutare** deloc: e o metaforă fizică (§D33), iar un raft filtrat la două
cărți arată ca o eroare de randare, nu ca un rezultat.

### D43 — Scanarea ISBN-ului e o a doua tastatură, nu o a doua cale de import

S11.1 cere scanarea codului de bare. Tentația e să o tratezi ca pe o integrare nouă — camera
citește, ceva aduce datele, formularul se umple. Nu e nevoie: **S4.2 face deja tot ce urmează după
ISBN.** Scrii treisprezece cifre în câmpul ISBN și pleacă verificarea de duplicat, apoi
completarea din Open Library, cu regulile ei deja stabilite.

**Decizie: scanerul raportează un ISBN și nimic altceva.** Fără rută nouă, fără serviciu nou, fără
a doua cale de completare care ar putea ajunge să se comporte diferit de cea tastată. Componenta e
o tastatură alternativă pentru un câmp.

**Linia care leagă totul e `shouldDirty`**, și e singura care ar strica funcționalitatea în tăcere
dacă lipsea: căutarea din S4.2 e condiționată de `dirtyFields.isbn`, deci un `setValue` fără el ar
umple câmpul și n-ar cere nimic — exact ce se vede când Open Library e picat. Are test propriu
tocmai pentru că nu se vede la citirea codului.

**Se verifică cifra de control, deși la tastare nu se verifică.** `isbnLookupSchema` spune explicit
de ce nu o verifică: pentru ceva *tastat*, „nu l-am găsit" e un răspuns mai adevărat decât „ISBN
invalid", iar o cifră inversată nu merită o acuzație. La cameră raționamentul se inversează —
un cod citit greșit e frecvent (o sclipire, o mișcare) și nimeni nu l-a tastat, deci nu e nimeni de
corectat. Cifra de control e exact mecanismul care prinde asta, iar eșecul înseamnă „mai caută", nu
„greșești": scanerul doar nu se oprește pe cadrul acela.

**Se cere prefixul Bookland, nu doar checksum-ul.** Un ISSN de revistă e un EAN-13 perfect valid
care începe cu 977, iar multe cărți au un **al doilea** cod de bare lipit lângă ISBN — prețul, ca
EAN-5. Un scaner care accepta primul cod decodat ar fi pus prețul în câmpul ISBN, iar căutarea ar fi
ratat dintr-un motiv pe care nimic de pe ecran nu l-ar fi explicat.

**Două motoare de decodare, o singură interfață.** `BarcodeDetector` e în browser pe Chrome pentru
Android și macOS, și lipsește pe iOS Safari, Firefox și Chrome pe Windows/Linux. Cum un cod de bare
se scanează ținând telefonul în mână, iar pe iOS toate browserele sunt Safari, varianta fără suport
nativ nu e un caz marginal, ci cel mai probabil. Deci: nativ când există, altfel ponyfill-ul din
`barcode-detector` (ZXing compilat în WebAssembly).

Nativul se verifică, nu se presupune: `getSupportedFormats()` spune dacă știe EAN-13, fiindcă lista
vine de la sistemul de operare. Un detector care există dar nu citește cărți ar deschide camera și
n-ar potrivi niciodată nimic.

**Wasm-ul se încarcă leneș și de pe originea noastră.** Ambele jumătăți sunt obligatorii. E un
megabyte, deci n-are ce căuta în pachetul pe care îl descarcă toată lumea ca să-și citească
biblioteca — un `import()` dinamic îl aduce la prima apăsare a butonului, pe browserele care au
nevoie de el. Și `zxing-wasm` l-ar lua implicit de pe un CDN, ceea ce ar încălca exact regula „zero
cereri către alte gazde" (kobo_design.md §Buget de pagină) pe care întreg proxy-ul de Open Library
există ca să o respecte; `?url` îl transformă în asset emis de Vite, servit de nginx din `/assets`.

**Camera se eliberează pe fiecare drum de ieșire**, inclusiv pe cel care nu are cleanup: `getUserMedia`
se rezolvă când utilizatorul răspunde la promptul de permisiune, ceea ce poate fi mult după ce a
închis dialogul. Stream-ul ajunge atunci fără nimeni care să-l opreacă, iar ledul camerei rămâne
aprins până se închide tab-ul. De aceea calea asincronă verifică un flag pus de cleanup, și de aceea
are test propriu.

**Are nevoie de HTTPS**, fiind un secure context. Aranjamentul din §D37 termină TLS pe 443, deci în
producție e în regulă, iar `localhost` e exceptat prin origine. Unde se vede lipsa: testarea de pe
telefon, pe o adresă din LAN, pe http — `navigator.mediaDevices` e pur și simplu `undefined`, ceea ce
e indistinct de „browserul nu poate". Se verifică `isSecureContext` separat tocmai ca mesajul să
spună cauza.

**Testarea are două niveluri, fiindcă niciunul nu ajunge singur.** jsdom nu are nici `getUserMedia`,
nici `BarcodeDetector`, deci suita unitară înlocuiește decodorul. Ce rămâne neacoperit acolo e exact
ce se poate strica: dacă wasm-ul se încarcă și citește un cadru. Așa că suita e2e îi dă lui Chromium
un fișier Y4M în loc de webcam (`--use-file-for-fake-video-capture`) — stream real, decodor real,
pixeli reali, doar lumina e sintetică. Videoul e **generat**, nu comis: codificarea EAN-13 scrisă în
`e2e/barcode-video.ts` e sursă care se poate citi, un binar de câteva sute de kilobytes n-ar fi.
Singurul lucru interceptat acolo e ruta de Open Library, ca verdele testului să nu depindă de un
terț care răspunde peste rețea — `retries: 0` există ca să nu absoarbă exact așa ceva.

**Kobo nu primește scanare**: dispozitivul nu are cameră.

---

### D44 — Interfața vorbește română și engleză

Contul ține limba, `User.locale`, iar restul decurge din asta.

**Ordinea de rezolvare, aceeași pe ambele capete:**

1. `User.locale`, dacă există sesiune. Cine a ales româna pe un laptop englezesc a ales româna —
   header-ul nu e un al doilea vot.
2. Altfel prima limbă din preferințele dispozitivului pe care o vorbim: `navigator.languages` în
   browser, `Accept-Language` pe server (`matchLocale`, `shared/src/locale.ts`).
3. Altfel engleză (`DEFAULT_LOCALE`).

**Prima potrivire câștigă; nu se caută `ro` în toată lista.** Un dispozitiv setat pe engleză cu
româna mai jos a exprimat o preferință, iar suprascrierea ei nu e negociere. Practic conteaza și
pentru sincronizare: Safari scurtează `Accept-Language` din motive de fingerprinting, în timp ce
`navigator.languages` rămâne întreg — o căutare pe toată lista ar fi găsit `ro` în browser și nu în
header, deci o limbă pe ecran și alta în textul erorii, pe aceeași pagină.

**`@default("ro")` pe coloană nu e limba implicită a aplicației.** Coloana păstrează ce văd
conturile care existau înainte de §D44, toate românești. Conturile *noi* nu iau acest default:
callback-ul Google le seamănă din `Accept-Language`, ca cineva venit pe un dispozitiv englezesc să
înceapă în engleză.

**Amendează §D21.** Predicția de acolo — că o a doua limbă costă doar mapele de etichete — s-a
dovedit adevărată pentru `STATUS_LABEL`/`GENRE_LABEL` și falsă pentru tot restul: mesajele de
validare din `shared/src/book.ts` erau românești, și încă vreo două sute de string-uri de JSX.
Identificatorii rămân englezești, neamendat.

**Schemele zod poartă chei, nu propoziții.** O schemă se construiește o dată, la încărcarea
modulului, deci nu poate ține text ales pe cititor; `translateIssue` o transformă în cuvinte la
afișare. Alternativa — scheme ca fabrici `(locale) => schema` — a fost respinsă pentru cât ar fi
atins: `bookFormSchema` ajunge la `zodResolver` la nivel de modul.

**Mesajele proprii zod** (constrângerile fără mesaj de-al nostru, `.max(255)`) vin din traducerile
zod v4, date **per parse** și nu prin `z.config`: o setare globală pe un server care răspunde
simultan unor cititori în limbi diferite e forma clasică a unui bug care apare doar sub încărcare.
Asta repară și o eroare mai veche — româna vedea engleza zod pentru orice constrângere neetichetată.

**Un `AppError` numește eșecul, filtrul îl formulează.** Serviciile nu au cititor, deci alegerea
cuvintelor nu e a lor; `AppExceptionFilter` ține cererea și decide. Corpul construit în
`DEFAULT_LOCALE` rămâne, pentru rutele cu filtru propriu (`OAuthFailureFilter`,
`McpAuthErrorFilter`) — degradare la o limbă, nu la o cheie pe ecran.

**Validarea e decorator de parametru, nu pipe.** Un pipe nu vede cererea, deci nu poate ști limba;
`createParamDecorator` primește `ExecutionContext`. Capcana e notată în `common/validated.ts`:
Nest decide „data sau pipe?" prin duck-typing pe `.transform`, iar schemele zod au un `.transform`.

**Ce nu urmează limba.** Suma rămâne în lei în ambele limbi — limba nu e regiune, iar cărțile din
bază au fost cumpărate în România (`shared/src/money.ts`). Uneltele MCP sunt în engleză, o dată,
pentru că le citește un model; ecranul de consimțământ MCP e pentru un om și e bilingv.

**`kobo-frontend/` rămâne în română deocamdată**, printr-o singură constantă (`KOBO_LOCALE`) — o
decizie, nu o omisiune. Nimic din `shared/` nu trebuie schimbat când îi va veni rândul.

### D45 — Categoriile devin o taxonomie pe două niveluri, în bază, multi-valoare

§D39 a înlocuit lista de 17 genuri literare cu 29 de categorii-subiect, dar tot ca o listă plată
de valori într-un `enum`, o singură valoare per carte. Cererea de a distinge **grupuri de
categorii** (titlurile-raft) de **categorii** (rafturile propriu-zise), și de a lăsa o carte să
stea pe mai multe rafturi deodată, i-a depășit forma.

**Decizie: taxonomia devine date, nu tip.** Trei tabele — `CategoryGroup` (titlu, neselectabil),
`Category` (raftul, singura frunză atașabilă unei cărți) și join-ul `BookCategory`. Sursa de
adevăr a arborelui e `backend/prisma/categories.data.ts`, din care s-a generat migrarea de seed;
la runtime, arborele trăiește în cele două tabele și se servește o dată prin `GET /categories`,
memorat agresiv de ambele frontend-uri.

**Un grup nu e niciodată o valoare.** Fiecare grup are cel puțin o frunză; cele cinci rafturi
reale fără subcategorii (Audiobooks, Culinare, Enciclopedii, Biografii, România) trăiesc ca frunze
sub grupul-coș `ALTELE`, ca invariantul să rămână absolut. Migrarea nu poate atașa un cod de grup
unei cărți nici măcar din greșeală: `CategoriesService.assertExist` respinge orice cod care nu e
rând de `Category`, deci un titlu ca `FICTION` e „inexistent".

**O carte are acum mai multe categorii (se anulează §D17).** Filtrarea devine și ea multi-valoare,
combinată cu OR (o carte se potrivește dacă e pe *oricare* raft cerut), exact forma pe care o are
deja filtrul de status. Doar frunze — „toată Medicina" se exprimă bifând rafturile, nu titlul.

**Redenumirea `genre` → `category` s-a făcut acum**, spre deosebire de §D39 care o refuzase.
Atunci nu cumpăra nimic fiindcă valorile enum-ului nu se schimbau; aici ștergem coloana și tipul
cu totul (`enum` → relație) și rescriem oricum fiecare referință, deci motivul de atunci a dispărut.

**Bilingvitatea se mută din tipuri în bază.** Garanția §D44 — o etichetă lipsă e eroare de
compilare — devine două coloane `NOT NULL` (`labelRo`/`labelEn`) plus un test de integritate a
seed-ului. Fiecare nod poartă ambele etichete pe sârmă, ca schimbarea de limbă să rămână un
re-render, nu o reîncărcare. `MANGA` e grupul netradus prin decizie (sursa e engleză): aceeași
valoare în ambele coloane, ca leii care rămân lei în ambele limbi (§D44). Uneltele MCP primesc un
`list_categories` care întoarce doar `labelEn` — un model citește, la fel ca restul uneltelor.

**Datele vechi se mapează, nu se golesc** (ca la §D39). Vechea valoare era mereu un *grup*, deci
fiecare carte se mută pe frunza `general` a grupului ei (`LEGACY_GENRE_MAP`) — onest și fără
pierdere: afirmăm grupul pe care-l știam și lăsăm raftul exact nesetat. Migrarea lărgește, scrie
join-ul din vechea coloană, apoi șterge coloana — aceeași secvență în trei pași ca §D39.

**Culoarea cotorului pe raft** nu mai e o mapă de 29 de hexuri păstrată completă de tip, ci un hash
stabil al codului de *grup* într-o bandă pastel (frontend/src/lib/shelf.ts): cărțile din același
grup rămân înrudite vizual, fără mapă de întreținut, iar un grup adăugat de o migrare viitoare e
colorat gratis. Decorativ, deci „prima categorie a cărții" e suficient (docs/DESIGN.md §Raftul).


### D48 — Formularul cărții se rupe în patru taburi, iar cartea capătă o recenzie

`BookFormDialog` era un singur ecran cu nouăsprezece câmpuri, iar §D40 i-a dat al douăzecilea —
descrierea, proză de câteva paragrafe într-un `textarea` de cinci rânduri, între ISBN și numărul
de pagini. Cererea de a adăuga **o recenzie lungă** lângă stele l-ar fi rupt de tot: două câmpuri
de proză într-o grilă de valori.

**Decizie: patru taburi — Carte · Descriere · Lectură · Verdict — și un singur Salvează.**
Taburile *nu* sunt pași. Nu există „Înainte", nu există ordine impusă, iar orice tab se atinge
dintr-un clic din oricare altul: majoritatea vizitelor în dialog schimbă exact un câmp și nu e
niciodată același. Ce cumpără împărțirea e că fiecare din cele două câmpuri de proză primește un
tab întreg, iar „unde a ajuns cartea" nu se mai citește în treacăt pe drum spre titlu.

Gruparea nu urmează cererea la literă (progres+rating într-un tab, istoric în altul), ci axa care
s-a dovedit adevărată: **Lectură** ține tot ce se schimbă în viața cărții (status, pagină,
cronologie, bani), **Verdict** ține actul de evaluare (stele + recenzie). Datele și progresul sunt
aceeași întrebare — cât de departe e cartea; nota și recenzia sunt același gest.

**Recenzia e a doua proză de pe carte, și e a cititorului.** Coloană `TEXT`, plafon 10 000 de
caractere — dublul descrierii, fiindcă publicul e altul: sinopsisul e recitit de un model prin
`get_book`, recenzia de omul care a scris-o. Se scrie **la orice status**, spre deosebire de
rating: jumătate din ce merită spus se scrie înainte de ultima pagină, iar o carte abandonată la
pagina patruzeci are recenzie de scris și n-are stele de dat (§D11 dă verdict, nu notă). Uneltele
MCP o expun ca pe orice câmp (`updateBookSchema.shape`), iar descrierea uneltei spune explicit ce
n-are voie modelul: să inventeze una sau să bage sinopsisul în ea.

**Trei reguli de interfață ies din decizia asta și se aplică peste tot în dialog:**

1. **Dezactivat, nu ascuns.** Un câmp care nu se aplică — pagina la o carte din wishlist, stelele
   la una în curs de citit — rămâne la locul lui, adâncit și inert, cu motivul în `title`. Vechiul
   formular ascundea stelele; un control care lipsește nu spune nimic, unul pe care-l vezi și nu-l
   poți folosi spune că există o regulă. Regulile stau în `form/locks.ts`, iar cea a ratingului e
   singura pe care o ține și serverul.
2. **Etichetă și valoare, nimic altceva.** Cele opt rânduri de „hint" au dispărut („Poate lipsi",
   „Opțional", „ex. 13x20 cm"): explicațiile trăiesc în `title`, unde nu ocupă spațiu. Singura
   excepție e contorul de caractere de sub cele două câmpuri cu plafon — `743 / 10.000`, cifre,
   fără propoziție.
3. **Ce nu se vede se marchează pe tab.** Un punct alamă = modificări nesalvate acolo; unul roșu
   = câmp invalid acolo. Fără el, un titlu șters în „Carte" în timp ce te uiți la „Verdict" e un
   buton Salvează care nu face nimic — `shouldFocusError` nu poate focaliza un input nemontat, deci
   ramura de eroare a lui `handleSubmit` comută tabul.

**Titlul din capul dialogului e cel salvat, nu ce se tastează.** O bară care oglindește câmpul de
dedesubt scrie același șir de două ori, tremură la fiecare tastă și se golește exact când titlul
vechi e cel mai util — când îl rescrii. Pastila de status, dimpotrivă, urmărește selecția: o
alegere care se confirmă nu e zgomot.

**S-a adăugat un roșu în paletă.** Erorile foloseau `status-abandoned`, care e gri: un mesaj pe
care nu-l vede nimeni. `--color-error: #E0674A` (5.4:1 pe `surface-1`), deliberat diferit de
slotul 2 al paletei de grafice (`#D95926`), ca un mesaj de validare să nu poată fi citit ca serie
de date (docs/DESIGN.md §Eroare).

**Kobo nu primește nimic din asta** (§D37): recenzia e o coloană pe care o poartă și tipul lui,
dar hârtia electronică citește un raft, nu editează proză.

---

## Ce a fost eliminat din backlogul inițial

- **Cele două story-uri „ca developer"** (cache pe Covers API, fallback Google Books). Primul
  nu era un story, ci o constrângere — a devenit criteriu de acceptanță transversal pentru
  Sprint 4 și decizia D8. Al doilea a fost eliminat la cerere: Open Library rămâne singura sursă
  externă.
- **S4.4 — „suprascriu manual orice câmp automat"**, tăiat la începutul Sprintului 4: era
  S1.3 repetat, plus un criteriu care apăra împotriva unei funcționalități inexistente (§D25).

## Ce a fost adăugat

- **S1.3 — editare și ștergere.** Backlogul inițial nu avea niciun story de delete, deci CRUD-ul
  era incomplet.
- **S1.5 — datele de status** (D1).
- **S1.6 — persistență** (D2).
- **S6.4 — alegerea monedei** (D16). Adăugat, apoi scos înainte de implementare (§D31).
- **O.1 — export/import**, în backlogul opțional.
- **Statusul `Abandonat`** (D11).
