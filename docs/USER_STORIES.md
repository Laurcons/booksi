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
- Câmpurile astfel populate rămân toate editabile (S4.4).
- Căutarea e debounced la minim 300ms — un request per pauză de tastare, nu per tastă.

### S4.2 — Completez o carte din ISBN
Ca utilizator, vreau ca la introducerea unui ISBN să se completeze automat titlul, autorul,
numărul de pagini și coperta.

- Acceptă ISBN-10 și ISBN-13.
- Dacă ISBN-ul nu e găsit, se afișează un mesaj clar și formularul rămâne complet manual.

### S4.3 — Placeholder și upload manual de copertă
Ca utilizator, vreau ca atunci când Open Library nu are copertă să văd un placeholder și să
pot încărca eu o imagine, ca să nu rămân cu o carte fără imagine.

- Placeholder-ul afișează titlul și autorul, ca să rămână identificabil în galerie.
- Upload-ul manual folosește exact același mecanism de stocare ca și coperta descărcată (§D8).

### S4.4 — Suprascriu manual orice câmp automat
Ca utilizator, vreau să pot corecta orice câmp completat automat, în cazul în care datele din
Open Library sunt greșite sau incomplete.

- Un câmp editat manual e marcat ca atare și **nu** mai e suprascris de o eventuală
  reîmprospătare ulterioară a datelor externe.

### Criterii de acceptanță transversale pentru Sprint 4
Acestea înlocuiesc story-urile „ca developer" din backlogul inițial — nu erau story-uri, ci
constrângeri asupra celor de mai sus.

- **Cache local:** datele și coperta se descarcă și se salvează local **în momentul selecției**.
  Nicio randare nu declanșează un apel către Open Library. O carte deja adăugată se afișează
  identic offline.
- **Rate limiting:** căutarea e debounced; nu există polling și nici prefetch în masă.
- **Degradare grațioasă:** dacă Open Library e indisponibil sau răspunde cu eroare, întreg
  fluxul manual din Sprint 1 rămâne utilizabil, fără blocaje.

---

## Sprint 5 — Galerie vizuală

**Livrabil:** experiența estetică. Plasat după Sprint 4 ca să existe coperte reale.

### S5.1 — Grid de coperți
Ca utilizator, vreau să văd toate cărțile ca grid de coperți, ca să le recunosc vizual rapid.

### S5.2 — Marchez cărți ca favorite
Ca utilizator, vreau să marchez o carte ca favorită.

- `favorit` e un flag ortogonal statusului: se poate marca și o carte din wishlist,
  necitită încă.

### S5.3 — Filtrez galeria
Ca utilizator, vreau să filtrez după status, gen literar și favorite.

- Filtrele sunt combinabile (ex. „gen = SF" + „favorite" + „status = Terminat").
- Filtrul de status acceptă selecție multiplă.

### S5.4 — Văd ratingul pe card
Ca utilizator, vreau să văd rating-ul în stele direct pe cardul cărții, fără să intru în detalii.

- Cardul afișează: copertă, titlu, autor, rating (dacă există), bară de progres
  (doar pentru `Citesc`), marcaj de favorit.

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

### S6.3 — Buget lunar/anual
Ca utilizator, vreau să-mi setez un buget lunar sau anual și să văd cât mai am disponibil.

- Restul nu se reportează: fiecare lună pornește de la bugetul complet. Vezi §D9.
- Depășirea e semnalată vizual, dar nu blochează nicio acțiune.

### S6.4 — Îmi aleg moneda
Ca utilizator, vreau să setez moneda în care se afișează toate sumele, ca cifrele să însemne ceva.

- O singură monedă globală, aplicată peste tot (wishlist, preț plătit, buget, grafice).
- Implicit RON. Nu se face conversie valutară — schimbarea monedei schimbă doar simbolul afișat,
  nu recalculează valorile deja introduse.

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

---

## Sprint 8 — Dashboard & raft

**Ultimul intenționat:** dashboard-ul e o agregare a tot ce s-a construit înainte. Făcut primul,
ar fi fost gol.

### S8.1 — Statistici rapide la deschidere
Ca utilizator, vreau să văd la deschiderea aplicației un dashboard cu cifrele principale
(cărți citite, în curs, pagini citite, cheltuit luna asta), ca să am o privire de ansamblu instantă.

- Toate valorile sunt derivate, cu aceleași reguli ca la S7.1 — nicio metrică nu se recalculează
  altfel pe dashboard decât în pagina de statistici.

### S8.2 — Raft vizual
Ca utilizator, vreau biblioteca reprezentată ca un raft cu cotoare de cărți, ca experiență
estetică/gamificată.

- Pe raft apar doar cărțile deținute: statusurile `Cumpărat`, `Citesc`, `Terminat`, `Abandonat`.
  Wishlist-ul nu apare — nu le ai încă.
- Grosimea cotorului e proporțională cu `total_pagini`; cărțile fără număr de pagini primesc
  o grosime medie implicită.
- Culoarea cotorului e derivată din gen.
- Ordonare implicită după `data_cumparare`, cu opțiune de sortare alfabetică.
- Click pe un cotor deschide detaliile cărții.

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
