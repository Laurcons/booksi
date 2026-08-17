# Bookcsi — User Stories

Backlog organizat pe sprinturi. Fiecare sprint e o **felie verticală** (date + logică + interfață)
care lasă aplicația utilizabilă de una singură, fără sprinturile următoare.

Deciziile de model de date și întrebările încă deschise sunt în [DECISIONS.md](DECISIONS.md).
Criteriile de acceptanță de mai jos sunt normative — ele închid ambiguitățile identificate
la analiza logică a backlogului inițial.

Reordonări permise: Sprint 6 ↔ Sprint 7 sunt interschimbabile. Sprint 5 poate urca înaintea
Sprintului 4 dacă se acceptă o galerie de placeholdere. Restul ordinii e impusă de dependențe
reale de date.

---

## Sprint 0 — Cont și autentificare

**Livrabil:** te poți autentifica și aplicația știe cine ești. Nu are încă ce să-ți arate —
singurul sprint din listă care nu livrează valoare de unul singur, dar e impus de decizia de
a avea conturi (§D2).

### S0.1 — Mă autentific cu Google
Ca utilizator, vreau să intru în aplicație cu contul meu Google, ca să nu-mi fac încă o parolă.

- Google OAuth 2.0 e singura metodă de autentificare. Nu există înregistrare cu parolă.
- La prima autentificare se creează automat contul, din datele returnate de Google
  (email, nume, avatar).
- Nu există flux de aprobare sau invitații: oricine are un cont Google își poate crea unul.

### S0.2 — Rămân autentificat
Ca utilizator, vreau ca sesiunea să reziste la reîncărcarea paginii și la închiderea
browserului, ca să nu mă loghez de fiecare dată.

- Sesiunea se păstrează într-un cookie `httpOnly`, inaccesibil din JavaScript.
- Există o acțiune explicită de delogare.
- La expirarea sesiunii, utilizatorul e redirecționat spre login fără să piardă date.

### S0.3 — Datele mele sunt doar ale mele
Ca utilizator, vreau ca biblioteca mea să fie vizibilă doar mie.

- Fiecare carte și fiecare setare aparțin unui utilizator.
- Toate interogările sunt filtrate pe utilizatorul autentificat, fără excepție. Un ID de carte
  ghicit din altă bibliotecă returnează 404, nu 403 — nu se confirmă existența.
- Toate rutele API cu excepția celor de autentificare cer sesiune validă.

---

## Sprint 1 — Bibliotecă manuală (nucleul)

**Livrabil:** un tracker de cărți complet funcțional, fără API extern și fără grafice.
Utilizabil în producție de unul singur.

### S1.1 — Adaug o carte manual
Ca utilizator, vreau să adaug o carte completând manual titlu, autor, nr. total de pagini,
gen și (opțional) ISBN, ca să-mi construiesc biblioteca.

- Obligatorii: titlu. Restul câmpurilor sunt opționale.
- Genul se alege dintr-o listă controlată, cu o singură valoare per carte (vezi
  [DECISIONS.md §D17](DECISIONS.md)), nu e text liber.
- ISBN-ul **nu** e cheie unică. La introducerea unui ISBN deja existent se afișează un
  avertisment („ai deja această carte"), dar salvarea nu e blocată — recitirile și edițiile
  duplicate sunt cazuri legitime.
- Formularul manual rămâne permanent disponibil, inclusiv după Sprint 4.

### S1.2 — Văd toate cărțile într-un tabel
Ca utilizator, vreau un tabel cu toate cărțile și detaliile lor, ca să le am pe toate într-un loc.

- Coloane: copertă (miniatură/placeholder), titlu, autor, status, pagini, preț, rating.
- Coloanele care depind de sprinturi ulterioare (preț, rating) apar goale până atunci.
- Tabelul e sortabil după titlu, autor, status și dată.

### S1.3 — Editez sau șterg o carte
Ca utilizator, vreau să pot modifica orice câmp al unei cărți sau să o șterg definitiv.

- Ștergerea cere confirmare.
- Orice câmp e editabil oricând, indiferent de sursa din care a fost populat.

### S1.4 — Urmăresc statusul unei cărți
Ca utilizator, vreau ca statusul unei cărți să urmeze fluxul
Wishlist → Cumpărat → Citesc → Terminat, ca să știu unde mă aflu cu fiecare.

- Statusurile posibile: `Wishlist`, `Cumpărat`, `Citesc`, `Terminat`, `Abandonat`.
- `Abandonat` e o stare terminală accesibilă din `Citesc`.
- Fluxul de mai sus e **happy path**, nu o constrângere: orice status e setabil direct, în orice
  ordine. Butonul principal de pe rând propune doar următorul pas natural.
- Motivul: fără tranziții libere nu se poate introduce o bibliotecă deja existentă.

### S1.5 — Datele de status reflectă realitatea, nu momentul introducerii
Ca utilizator, vreau ca fiecare tranziție de status să înregistreze o dată pe care să o pot
corecta manual, ca să pot adăuga și cărți citite în trecut fără să-mi stric statisticile.

- La tranziție se setează automat data curentă pentru: `data_cumparare`, `data_start_lectura`,
  `data_terminare`.
- Toate trei sunt editabile de utilizator în orice moment.
- Aceste câmpuri sunt sursa unică pentru graficele din Sprint 6 și 7. Fără ele, acele
  sprinturi nu pot fi implementate.

### S1.6 — Biblioteca mea persistă
Ca utilizator, vreau ca biblioteca să fie acolo când redeschid aplicația, indiferent de browser
sau device, ca să nu reintroduc totul de fiecare dată.

- Datele se salvează server-side (MongoDB), nu în browser.
- Consecință: aplicația necesită conexiune. Nu există mod offline în MVP.
- Dacă există sau nu conturi de utilizator rămâne deschis — vezi
  [DECISIONS.md §D2](DECISIONS.md).

---

## Sprint 2 — Progres & evaluare

**Livrabil:** tracking real al lecturii, nu doar inventar.

### S2.1 — Notez paginile citite
Ca utilizator, vreau să înregistrez la ce pagină am ajuns într-o carte, ca să văd progresul.

- Se stochează o singură valoare curentă (`pagini_citite`), nu un istoric de sesiuni.
- Consecință acceptată: nu se pot genera grafice de tip „pagini pe săptămână". Vezi §D3.

### S2.2 — Văd un indicator de progres
Ca utilizator, vreau un indicator vizual de progres pentru fiecare carte în curs de citire.

- Progresul e **derivat**: `pagini_citite / total_pagini`. Nu se stochează.
- Dacă `total_pagini` lipsește, se afișează doar „pag. 143", fără procent și fără bară.
  Cazul e frecvent, nu excepțional — vezi §D4.
- La trecerea în `Citesc`, dacă `total_pagini` lipsește, se cere o singură dată (skip permis).
- Indicatorul apare în: tabelul din Sprint 1, cardul din galerie (Sprint 5), dashboard (Sprint 8).

### S2.3 — Acord rating
Ca utilizator, vreau să dau un rating în stele cărților pe care le-am terminat.

- Scală 1–5 stele, pas întreg.
- Disponibil pentru statusurile `Terminat` și `Abandonat`.
- Ratingul e opțional. Cărțile terminate fără rating sunt excluse din calculul mediei (§D5).

### S2.4 — Notez suma plătită
Ca utilizator, vreau să înregistrez cât am plătit efectiv pe fiecare carte.

- Câmp distinct de prețul estimat din wishlist (Sprint 3). Vezi §D6.
- Doar `pret_platit` alimentează bugetul din Sprint 6.

---

## Sprint 3 — Wishlist

**Livrabil:** planificare de cumpărături. Independent de Sprinturile 4–8.

### S3.1 — Vedere separată de wishlist
Ca utilizator, vreau o listă cu cărțile pe care vreau să le citesc, separată de biblioteca activă.

- Nu e o entitate separată: e o vedere filtrată pe `status = Wishlist`.

### S3.2 — Prețul estimat per carte
Ca utilizator, vreau să notez cât cred că o să coste fiecare carte din wishlist.

- Câmp `pret_estimat`, user-input. Open Library nu furnizează prețuri.
- Opțional — o carte poate sta în wishlist fără preț.

### S3.3 — Costul total al wishlist-ului
Ca utilizator, vreau să văd cât m-ar costa să cumpăr tot ce am în wishlist.

- Suma se calculează doar peste cărțile care au preț, iar sub total se afișează explicit
  acoperirea: „total 340 lei — 7 din 11 cărți au preț estimat".

### S3.4 — Mut o carte din wishlist în bibliotecă
Ca utilizator, vreau să marchez o carte ca fiind cumpărată printr-un singur click, fără să
reintroduc date.

- Un click, fără modal: `status → Cumpărat`, `data_cumparare → azi`,
  `pret_platit → pret_estimat`.
- Toate trei rămân editabile ulterior din tabel.
- Dacă `pret_estimat` lipsește, `pret_platit` rămâne gol — nu se blochează acțiunea.

---

## Sprint 4 — Integrare Open Library

**Livrabil:** dispare munca de completare manuală. Adăugarea manuală din Sprint 1 rămâne
funcțională ca fallback permanent.

Fără fallback Google Books — Open Library e singura sursă externă.

### S4.1 — Caut o carte după titlu și autor
Ca utilizator, vreau să caut o carte după titlu și/sau autor și să aleg rezultatul corect
dintr-o listă cu coperte mici, ca să nu fie nevoie să știu ISBN-ul.

- Se folosește Open Library Search API.
- Rezultatele sunt *works*, nu ediții. La selecție se ia automat ediția implicită
  (`cover_edition_key`) pentru copertă, ISBN și nr. de pagini. Vezi §D7.
- Câmpurile astfel populate rămân toate editabile — S1.3 le acoperă deja: orice câmp e
  editabil oricând, indiferent de sursa care l-a populat.
- Căutarea e debounced la minim 300ms — un request per pauză de tastare, nu per tastă.
- **Unde stă căutarea:** o bandă în capul dialogului „Adaugă o carte", deasupra câmpului
  Titlu — nu un ecran separat și nu un pas înaintea formularului. Formularul manual rămâne
  vizibil tot timpul (S1.1), iar selecția unui rezultat doar îi completează câmpurile.
  Apare doar la adăugare, nu și la editare.
- **Miniaturile trec tot prin backend.** Lista de rezultate nu primește URL-uri
  `covers.openlibrary.org` pe care să le încarce browserul: regula „frontendul nu atinge
  niciodată openlibrary.org direct" rămâne absolută.

### S4.2 — Completez o carte din ISBN
Ca utilizator, vreau ca la introducerea unui ISBN să se completeze automat titlul, autorul,
numărul de pagini și coperta.

- Acceptă ISBN-10 și ISBN-13, cu sau fără cratime.
- Dacă ISBN-ul nu e găsit, se afișează un mesaj clar și formularul rămâne complet manual.
- **Ordinea pe câmpul ISBN:** întâi verificarea de duplicat („ai deja această carte", S1.1 /
  §D13), abia apoi completarea din Open Library. Avertismentul nu blochează completarea —
  duplicatele sunt legitime, deci se văd amândouă deodată.
- Cifra de control nu se verifică: un ISBN tastat greșit trebuie să iasă „nu l-am găsit", nu
  „ISBN invalid".

### S4.3 — Încarc manual o copertă
Ca utilizator, vreau să pot încărca eu o imagine de copertă, ca să nu rămân cu o carte fără
imagine când Open Library nu are una. Cazul e frecvent.

- Upload-ul folosește exact același mecanism de stocare ca și coperta descărcată (§D8, §D18).
- Formate acceptate: JPEG, PNG, WebP — **verificate după primii octeți, nu după
  `Content-Type`**. Antetul e afirmația clientului, iar imaginea ajunge servită înapoi de pe
  originea noastră cu eticheta cu care a fost stocată.
- Limita e 5MB, verificată și pe `Content-Length`, și pe octeții care chiar sosesc.
  Frontendul redimensionează înainte (max 1000px pe latura lungă, JPEG q0.85, tipic sub
  250KB), dar asta e o curtoazie, nu o măsură de securitate.
- O carte are o singură copertă (§D18, relație 1:1): un upload nou o înlocuiește pe cea veche.
- Coperta e servită cu `immutable` pe un an, deci URL-ul poartă `?v=<versiune>` — vezi §D25.

Placeholder-ul de copertă a fost mutat la **S5.5**: e o preocupare de afișare, nu de
integrare, iar DESIGN.md îl specifică pentru grila din Sprint 5.

### Criterii de acceptanță transversale pentru Sprint 4
Acestea înlocuiesc story-urile „ca developer" din backlogul inițial — nu erau story-uri, ci
constrângeri asupra celor de mai sus.

- **Cache local:** datele se completează în formular la selecție, iar coperta se descarcă și
  se salvează **la crearea cărții** (`POST /books`), nu în momentul selecției — o carte
  căutată și abandonată în formular nu trebuie să lase un blob în bază. Nicio randare a unei
  cărți deja adăugate nu declanșează un apel către Open Library; se afișează identic offline.
- **Rate limiting:** căutarea e debounced în frontend; rutele de proxy au în plus o limită
  proprie de 10 cereri/secundă. Fără polling, fără prefetch în masă.
- **Degradare grațioasă:** dacă Open Library e indisponibil sau răspunde cu eroare, întreg
  fluxul manual din Sprint 1 rămâne utilizabil, fără blocaje. În particular, o carte creată
  cu `olEditionKey` se creează **și** dacă descărcarea coperții eșuează.

### S4.4 — eliminat
„Suprascriu manual orice câmp automat" a fost tăiat, nu amânat. Partea de story era deja
livrată de S1.3 („orice câmp e editabil oricând, indiferent de sursa din care a fost
populat"), iar singurul criteriu nou apăra împotriva unei reîmprospătări ulterioare a datelor
externe — care nu există nicăieri în backlog. Fără refresh, câmpul `manuallyEditedFields` s-ar
fi scris la fiecare editare și nu s-ar fi citit niciodată; a fost scos și din schemă.

---

## Sprint 5 — Galerie vizuală

**Livrabil:** experiența estetică. Plasat după Sprint 4 ca să existe coperte reale.

### S5.1 — Grid de coperți
Ca utilizator, vreau să văd toate cărțile ca grid de coperți, ca să le recunosc vizual rapid.

- Ecran propriu — intrarea „Galerie" din navigație, gri de la Sprint 1 încoace. Nu înlocuiește
  tabelul din S1.2 și nu e un comutator peste el. Vezi §D28.
- Fără control de sortare: rămâne ordinea implicită a bibliotecii, cele mai noi întâi.

### S5.2 — Marchez cărți ca favorite
Ca utilizator, vreau să marchez o carte ca favorită.

- `favorit` e un flag ortogonal statusului: se poate marca și o carte din wishlist,
  necitită încă.
- Se scrie prin ruta de editare, ca orice alt câmp, fără rută proprie (§D30). Steluța stă pe
  cardul din galerie; tabelul din S1.2 nu primește coloană de favorit.

### S5.3 — Filtrez galeria
Ca utilizator, vreau să filtrez după status, gen literar și favorite.

- Filtrele sunt combinabile (ex. „gen = SF" + „favorite" + „status = Terminat").
- Filtrul de status acceptă selecție multiplă.
- Se aplică în SQL, pe aceeași rută de listare ca tabelul, nu în client (§D29). Un filtru
  nebifat nu trimite parametrul: absent înseamnă „fără filtru".
- Când filtrele nu potrivesc nimic, mesajul e despre filtre și oferă resetarea lor — nu
  „încă n-ai nicio carte", care ar fi fals cu biblioteca plină.

### S5.4 — Văd ratingul pe card
Ca utilizator, vreau să văd rating-ul în stele direct pe cardul cărții, fără să intru în detalii.

- Cardul afișează: copertă, titlu, autor, rating (dacă există), bară de progres
  (doar pentru `Citesc`), marcaj de favorit.

### S5.5 — Placeholder de copertă
Ca utilizator, vreau ca o carte fără copertă să arate tot a carte în galerie, nu a imagine
lipsă.

Mutat aici din S4.3: e o preocupare de afișare, nu de integrare cu Open Library, iar
DESIGN.md §Placeholderul de copertă îl specifică explicit pentru grilă.

- Varianta mică există deja din Sprint 1 (`CoverThumb`, în tabelul S1.2): fundal `surface-3`,
  chenar interior de alamă, inițiala titlului. La 32×48 titlul întreg nu încape.
- Varianta mare, pentru grid: titlul cu Playfair centrat, autorul dedesubt.
- Nu e o iconiță generică de „imagine lipsă": în grilă, zeci de placeholdere goale strică
  raftul.

---

## Sprint 6 — Buget

Depinde de `pret_platit` (S2.4) și `data_cumparare` (S1.5).

### S6.1 — Totalul cheltuit
Ca utilizator, vreau să văd suma totală cheltuită pe cărți până acum.

- Se însumează doar `pret_platit`. Prețurile estimate din wishlist nu intră niciodată în buget.

### S6.2 — Graficul cheltuielilor în timp
Ca utilizator, vreau un grafic cu banii cheltuiți pe cărți în timp, ca să-mi urmăresc bugetul.

- Grupare lunară, pe baza `data_cumparare`.
- Cărțile fără `data_cumparare` sunt excluse din grafic, dar incluse în totalul de la S6.1,
  iar diferența e semnalată vizibil.

### S6.3 — Buget lunar
Ca utilizator, vreau să-mi setez un buget lunar și să văd cât mai am disponibil.

- Doar lunar — nu și anual (§D31). „Disponibil" = bugetul minus cheltuiala lunii curente.
- Restul nu se reportează: fiecare lună pornește de la bugetul complet. Vezi §D9.
- Depășirea e semnalată vizual (cifra devine negativă), dar nu blochează nicio acțiune.
- Cărțile fără `data_cumparare` nu intră în cifra lunii, la fel ca în grafic, iar diferența
  se arată și aici.

### S6.4 — Îmi aleg moneda — **nu se implementează**
Ca utilizator, vreau să setez moneda în care se afișează toate sumele, ca cifrele să însemne ceva.

- Scos din sprint. Sumele rămân în lei, scris în interfață; nu există ecran de setare a
  monedei și nici câmp în API. Coloana `currency` rămâne în tabel, cu implicitul ei (§D31).

---

## Sprint 7 — Statistici lectură

Depinde de `data_terminare` (S1.5).

### S7.1 — Statistici generale
Ca utilizator, vreau statistici generale: total cărți citite, total pagini citite, rating mediu.

- **Cărți citite** = numărul cărților cu `status = Terminat`. Abandonatele nu se numără.
- **Pagini citite** — regula unică de agregare (§D10):
  | Status | Contribuție |
  |---|---|
  | `Terminat` | `total_pagini` |
  | `Citesc` | `pagini_citite` |
  | `Abandonat` | `pagini_citite` |
  | `Cumpărat`, `Wishlist` | 0 |
- **Rating mediu** = media peste cărțile care **au** rating. Cele fără rating sunt excluse din
  numitor.

### S7.2 — Evoluția lecturii în timp
Ca utilizator, vreau să văd câte cărți am citit pe lună.

- Grupare lunară pe `data_terminare`.
- Cărțile terminate fără dată de terminare sunt excluse din grafic, iar numărul lor e afișat
  explicit.
- Seria e **densă**, ca la S6.2: lunile fără nicio carte terminată apar cu zero, de la prima
  lună datată până la luna curentă. Aceeași regulă, același motiv (§D31).
- Se numără doar cărțile în `Terminat`, aceeași populație ca la S7.1 — o recitire duce cartea
  înapoi în `Citesc` fără să-i șteargă data (S1.5), iar barele trebuie să adune exact cifra
  scrisă deasupra lor.

---

## Sprint 8 — Dashboard & raft

**Ultimul intenționat:** dashboard-ul e o agregare a tot ce s-a construit înainte. Făcut primul,
ar fi fost gol.

### S8.1 — Statistici rapide la deschidere
Ca utilizator, vreau să văd la deschiderea aplicației un dashboard cu cifrele principale
(cărți citite, în curs, pagini citite, cheltuit luna asta), ca să am o privire de ansamblu instantă.

- Toate valorile sunt derivate, cu aceleași reguli ca la S7.1 — nicio metrică nu se recalculează
  altfel pe dashboard decât în pagina de statistici. Concret: aceleași cifre vin din același
  `GET /stats/overview`, iar „cheltuit luna asta" din `/budget/summary`, care o calculează
  de la S6.3.
- **Unde:** sus pe `/`, deasupra tabelului (§D32). „La deschidere" e o cerință despre ecranul
  de start, nu o înlocuire a lui — §D28 lasă tabelul de la S1.2 neatins.
- Ratingul mediu nu e printre cele patru cifre: e a treia cifră a lui S7.1 și rămâne pe `/stats`.

### S8.2 — Raft vizual
Ca utilizator, vreau biblioteca reprezentată ca un raft cu cotoare de cărți, ca experiență
estetică/gamificată.

- Pe raft apar doar cărțile deținute: statusurile `Cumpărat`, `Citesc`, `Terminat`, `Abandonat`.
  Wishlist-ul nu apare — nu le ai încă.
- Grosimea cotorului e proporțională cu `total_pagini`; cărțile fără număr de pagini primesc
  o grosime medie implicită.
- Culoarea cotorului e derivată din gen.
- Ordonare implicită după `data_cumparare`, cu opțiune de sortare alfabetică. Amândouă sunt
  sortări server-side pe ruta de listare (§D29), nu un `sort()` în client.
- Click pe un cotor deschide detaliile cărții — același ecran pe care îl deschide un card din
  galerie (S5.1). „Detaliile cărții" sunt un singur ecran în aplicație.
  **Actualizat de S9.1:** acel ecran era `BookFormDialog`; de la §D41 e `/books/:id`, iar
  formularul rămâne doar suprafața de editare. Regula „un singur ecran" ține în continuare —
  s-a schimbat care e.
- Cotorul e un buton: se ajunge la el cu tastatura, iar fișa lui apare și la focus, nu doar la
  hover. Un raft care se citește doar cu mausul e decor.
- **Unde:** `/shelf`, pe a șasea intrare din navigație — cea care a scris „Tracker" opt
  sprinturi fără ca vreun story să livreze ceva cu numele ăsta (§D32).

---

## Sprint 9 — Fișa cărții

**Din afara planului inițial.** Primul story cerut după ce cele opt sprinturi erau livrate, și
primul care depinde de MCP ca să-și țină promisiunea: descrierea nu vine de la bookcsi.

### S9.1 — Fișa cărții, cu descriere
Ca utilizator, vreau un ecran care să arate toate detaliile unei cărți plus o descriere a ei,
ca să văd cartea întreagă fără să deschid formularul de editare.

- **Unde:** `/books/:id`, singura rută cu parametru din aplicație — o carte e singurul lucru din
  bookcsi care merită link direct.
- Se ajunge acolo din toate cele cinci locuri unde apare o carte: titlul din tabel, cardul din
  galerie, cotorul de pe raft, rândul dintr-o provocare și rândul din wishlist. Creionul de lângă
  titlu deschide în continuare formularul (§D41) — fișa se citește, dialogul scrie.
- Butonul „înapoi" duce **acolo de unde s-a venit**, cu numele ecranului scris pe el („Înapoi la
  raft"). O carte deschisă dintr-un link sau după un F5 nu are de unde veni: atunci duce la
  wishlist dacă e o carte de pe wishlist, altfel la bibliotecă. Niciodată în afara aplicației
  (§D41 explică de ce nu e `navigate(-1)`).
- Câmpurile lipsă nu se afișează cu liniuță — majoritatea cărților au o mână de detalii din
  unsprezece (§D4), iar o grilă mai mult goală nu spune nimic.
- Ștergerea de pe fișă duce înapoi la ecranul de origine, nu lasă utilizatorul pe pagina unei
  cărți care nu mai există.

### S9.2 — Descrierea o completează Claude
Ca utilizator, vreau ca Claude să caute pe net despre ce e cartea și să-mi scrie descrierea în
bibliotecă, ca să n-o scriu eu pentru fiecare carte.

- **bookcsi nu aduce descrieri.** Nu există căutare pe web în aplicație și nu se preia descrierea
  din Open Library — integrarea cu Claude se face **numai prin MCP** (§D40).
- Nu există unealtă MCP nouă: descrierea e un câmp ca oricare altul, scris prin `update_book` (sau
  dat direct la `add_book`). Descrierea uneltei îi spune modelului că poate căuta și ce ton să
  folosească — română, persoana a treia, fără spoilere.
- `get_book` întoarce descrierea; `search_library` **nu** — altfel o întrebare de tipul „ce cărți
  am" ar costa un sinopsis per carte din contextul conversației (§D40).
- Descrierea e editabilă din formular ca orice alt câmp: ce a scris Claude se poate corecta, iar
  golirea casetei șterge coloana.
- Nu se reține că descrierea a fost scrisă de un model. Nu există etichetă „generat de AI" și nici
  câmp de proveniență — §D40 spune de ce.

---

## Backlog opțional (neprogramat)

Story-uri utile, dar care nu blochează niciun sprint. De prioritizat când e cazul.

### O.1 — Export și import
Ca utilizator, vreau să export toată biblioteca într-un fișier și să o pot reimporta, ca să am
o copie de siguranță și să nu depind exclusiv de server.

- Export: un singur fișier JSON cu toate cărțile și setările.
- Import: adaugă cărțile din fișier; duplicatele produc avertisment, la fel ca la S1.1.
- Coperțile se includ în export (encodate), altfel copia de siguranță e incompletă.
- Prioritatea a scăzut față de varianta local-only: datele stau server-side, deci un browser
  golit nu mai șterge nimic.
