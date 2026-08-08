# Bookcsi pe Kobo — sistem de design

Sistemul de design al suprafeței Kobo (§D37). Se citește **peste** `DESIGN.md`, nu în locul lui:
ce nu e contrazis aici rămâne valabil.

**Documentul nu mai e provizoriu.** A fost scris înainte să existe vreo măsurătoare, cu fiecare
număr care depindea de dispozitiv marcat `§P…` către lista de la final. `/probe` a rulat pe
dispozitiv pe 7 august 2026, deci lista aceea are acum răspunsuri: ce s-a măsurat e scris mai
jos ca valoare, nu ca referință, iar §P a devenit evidența a ce s-a întrebat și ce s-a aflat.
Trei rânduri au rămas fără răspuns și sunt marcate ca atare — acolo fallback-ul e în vigoare,
nu e o alegere deschisă.

Măsurătorile brute stau în `kobo-frontend/reports/`, care e în `.gitignore`: capturile de pe un
dispozitiv anume nu sunt sursă de proiect. De-aia cifrele care contează sunt copiate în text
aici, nu doar citate.

Restul — principiile, ce se păstrează din identitate și ce se aruncă — nu depindea de dispozitiv
și n-a fost atins.

---

## Spiritul, într-o frază

**Cartea tipărită, nu biblioteca la lumina lumânării.**

`DESIGN.md` numește trei lucruri în identitate: *cald*, *întunecat* și *tipografie de carte
tipărită*. Pe Kaleido, primele două nu se pot reproduce, iar al treilea se poate reproduce mai
bine decât pe orice ecran cu lumină proprie. Deci nu se face un compromis între ele: se ia
jumătatea tipografică întreagă și se renunță la cea cromatică pe față, ca decizie, nu ca
scăpare.

Consecința care conduce tot restul: **suprafața Kobo e albă cu cerneală neagră.** Nu e „tema
light pe care n-o avem" (§Temă din `DESIGN.md`), fiindcă nu e o preferință de utilizator și nu
apare niciun comutator. E singura formă în care hârtia electronică e lizibilă.

---

## Ce se moștenește și ce cade

| Din `DESIGN.md` | Pe Kobo |
|---|---|
| Cromatica vine din coperți | **Cade.** Coperțile ajung tot în tonuri de gri, la 15mm lățime și sub filtru (§Coperți). Nu mai există „pată de culoare" de apărat. |
| Tipografia face eleganța | **Se păstrează, întărită.** E singurul instrument rămas. |
| Densitate mică | **Se păstrează, întărită.** Ecran mic, atingere imprecisă, o reîmprospătare pe pagină. |
| Temă închisă | **Se inversează.** Vezi mai jos. |
| Auriul de brand | **Cade.** `#E3B04B` pe gri devine un gri mediu oarecare. |
| Culorile de status | **Se degradează controlat** — vezi §Status. |
| Paleta categorială de grafice | **Cade integral.** Graficele nu mai poartă culoare. |
| Cifre tabulare pe bani | **Se păstrează.** Regula e independentă de mediu. |
| Statusul nu se transmite doar prin culoare | **Se păstrează, devine obligatoriu.** |

### De ce inversarea nu e o trădare a identității

Fundalul întunecat pe hârtie electronică cere ca aproape fiecare pixel al panoului să fie în
poziția neagră. Trei consecințe, toate rele: contrastul scade (Kaleido pune filtrul de culoare
peste panoul monocrom, deci pornește deja sub un Carta obișnuit), fantomele rămase de la pagina
anterioară devin vizibile pe câmpul întunecat, iar fiecare întoarcere de pagină e o
reîmprospătare completă a unei suprafețe mari.

Un ecran care nu emite lumină nu are nevoie de temă întunecată — motivul pentru care temele
închise există pe telefoane (lumina în ochi seara) nu se aplică deloc aici.

---

## Mediul, ca listă de constrângeri

Nu sunt preferințe. Sunt lucruri pe care hârtia electronică le impune.

1. **O reîmprospătare per interacțiune.** Orice schimbare vizuală costă o clipire. Deci: nimic nu
   se mișcă, nimic nu se actualizează singur, iar navigarea între pagini întregi nu e mai
   scumpă decât o actualizare parțială — de-aia paginile înlocuiesc dialogurile.
2. **Fantome.** Suprafețele mari și negre lasă urme la pagina următoare. Preferă **conturul în
   locul umpluturii**: un buton cu chenar de 3px și text negru, nu un dreptunghi plin.
3. **Fără hover.** Nu există stare intermediară între „nu ating" și „am apăsat". Orice informație
   ascunsă în spatele lui hover e informație pierdută — inclusiv tooltipurile de pe grafice, pe
   care `DESIGN.md` le cere implicit.
4. **Atingere imprecisă și lentă.** Ținte mari, distanțate, cu etichetă text.
5. **Butoanele fizice de pagină nu derulează paginile web.** Derularea se face cu degetul, deci
   listele lungi se paginează.
6. **Lat în pixeli, mic în mână.** Ecranul e 1264×1680 la 300ppi, iar browserul raportează exact
   acei pixeli: 1212×1264 pixeli CSS utili, la `devicePixelRatio` 1 (§P1). Nu e un viewport de
   telefon — e un viewport larg pe o suprafață de 4,2 țoli. O singură coloană rămâne regula, dar
   nu fiindcă n-ar încăpea două: fiindcă lățimea fizică și degetul n-au crescut odată cu
   numărul de pixeli.
7. **Culoarea e la 150ppi, sub un filtru.** Jumătate din rezoluția cernelii negre, și stinsă —
   confirmat cu ochiul pe dispozitiv, nu dedus (§P5).

---

## Unități: un pixel CSS e a trei suta parte dintr-un țol

Măsurătoarea care schimbă cel mai mult din document (§P1). Browserul onorează
`<meta name="viewport" content="width=device-width, initial-scale=1">`, raportează
`devicePixelRatio` 1 și un viewport de 1212×1264. Panoul are 300ppi. Deci:

**1 pixel CSS = 1 pixel fizic = 1/300 dintr-un țol.**

Nu e situația de pe un telefon, unde motorul pune un strat de scalare între foaia de stil și
panou. Aici stratul ăla nu există. Un corp de literă de 16px are 1,35mm înălțime — pe dispozitiv
e nelizibil, și exact așa s-a și văzut la mostrele de text de pe `/probe`.

Tot documentul dă mărimile în puncte tipografice și milimetri tocmai ca să nu depindă de
ipoteza asta. Acum conversia se poate face, o dată:

```ts
// kobo-frontend/src/lib/units.ts
export const PX_PER_INCH = 300;
export const PX_PER_PT = PX_PER_INCH / 72; // 4,1667
export const PX_PER_MM = PX_PER_INCH / 25.4; // 11,811
```

Un singur loc de schimbat dacă se descoperă vreodată că browserul aplică totuși o scalare
proprie. Nicio pagină nu scrie un px la mână.

### Consecința care se uită ușor

Factorul față de un ecran obișnuit e **~3,1×** (300ppi față de 96). Nu se aplică doar
tipografiei: **orice valoare în px copiată din `DESIGN.md`, sau venită din reflexul de pe web, e
greșită cu același factor.**

| Ce înseamnă pe web | Aici |
|---|---|
| linie sau chenar de 1px | **3px** — 0,25mm, exact cât are un „1px" pe un ecran de 96ppi |
| accent de 2px | **6px** |
| rază de 2px pe copertă | **6px** |
| corp de literă de 16px | **50px** (adică cei 12pt din §Scara) |

Un chenar scris `1px` are 0,08mm și dispare la dithering. E cel mai probabil defect al oricărei
pagini scrise fără să te uiți la tabelul ăsta.

---

## Culoare

### Cerneală și suprafețe

Motorul nu are proprietăți personalizate — măsurat, nu presupus (§P4) — deci „tokenurile" nu
sunt variabile CSS. Stau într-un modul TypeScript (`kobo-frontend/src/lib/tokens.ts`) și se
interpolează în `<style>`-ul inline al paginii. Un singur loc de schimbat, verificat de `tsc`,
fără să depindă de o funcționalitate a motorului. Nici `@supports` nu există (§P4), deci nu se
poate nici măcar întreba din CSS ce lipsește: singura degradare disponibilă e ordinea în
cascadă — declarația veche prima, cea nouă după ea, iar motorul o ignoră pe a doua în tăcere.

| Rol | Valoare | Unde |
|---|---|---|
| `inkPrimary` | `#000000` | tot textul citit |
| `inkSecondary` | `#4A4A4A` | metadate, etichete — **niciodată sub 14pt** |
| `inkMuted` | `#6E6E6E` | podeaua absolută; doar text ≥ 14pt, niciodată cifre |
| `rule` | `#000000` | separatoare, chenare — 3px, negru, nu gri (§Unități) |
| `fillQuiet` | `#DCDCDC` | umplere de bară, fundal de rând alternativ |
| `surface` | `#FFFFFF` | fundal, singurul |

Trei reguli care contrazic instinctele de pe web:

- **Griurile medii se folosesc pentru umpluturi, nu pentru text.** Toate cele 11 trepte ale
  rampei de pe `/probe` s-au distins clar (§P6), deci griul e un instrument real, nu unul
  teoretic — dar el se obține prin dithering: un gri mediu întins e o textură, nu o culoare. La
  suprafață mare se vede bine; la corp de literă mic distruge conturul.
- **Liniile sunt negre, nu gri deschis.** Un chenar `#E0E0E0` de 3px poate dispărea complet după
  dithering — iar unul scris `1px` dispare oricum, indiferent de culoare (§Unități).
  `DESIGN.md` folosește `--border` discret fiindcă acolo cardurile s-ar topi; aici problema e
  inversă.
- **Fără transparență.** Pastilele din `DESIGN.md` au fundaluri `rgba(...,.14)`; pe hârtie
  electronică asta produce un gri imprevizibil. Se scriu culori opace.

### Status

Culorile de status din `DESIGN.md` sunt rezervate și poartă întotdeauna și textul. Regula a doua
salvează situația: **eticheta text e deja obligatorie, deci se poate scoate culoarea fără să se
piardă informație.**

Pe Kobo statusul e o pastilă cu chenar de 3px negru, text negru, fundal alb — iar canalul
redundant devine **stilul chenarului**, nu culoarea:

| Status | Chenar | Notă |
|---|---|---|
| Wishlist | punctat | „încă nu e a ta" |
| Cumpărat | continuu subțire (3px) | |
| Citesc | continuu gros (6px) | singurul îngroșat: e starea activă |
| Terminat | dublu | |
| Abandonat | punctat, text `inkSecondary` | singura pastilă cu cerneală mai stinsă |

Culoarea Kaleido **nu** se folosește aici. O pastilă are 6–8mm lățime; la 150ppi, sub filtru, o
culoare pe o suprafață atât de mică iese ca un gri murdar cu franjuri, adică mai rău decât
alb-negru curat. §P5 a confirmat că mostrele de culoare se văd colorate, dar stinse — ceea ce
nu schimbă nimic aici: „se vede că e roșu" pe un pătrat de 60×44 nu înseamnă „se citește ca
roșu" pe conturul unei pastile.

### Unde are voie culoarea să apară

Doar acolo unde suprafața e mare, plată, și culoarea nu poartă singură informația. Proba a arătat
că e loc de încercat — culorile ajung vizibil departe de gri, chiar dacă stinse (§P5) — deci
lista de mai jos e de făcut, nu de discutat, în ordinea asta:

1. **Cotoarele din raft.** Suprafețe verticale mari, rampă deja pastelată și explicit
   *decorativă* în `DESIGN.md` — nu se citesc valori din ele. E cazul ideal.
2. **Depășirea bugetului lunar.** Un singur element pe pagină, cu text alături.

Nicăieri altundeva fără o probă vizuală pe dispozitiv.

---

## Tipografie

**Nicio literă nu se descarcă.** Playfair Display și Inter sunt fonturi variabile servite ca
`woff2`; motorul le ignoră axele în cel mai bun caz și nu le încarcă deloc în cel mai probabil.
Se folosesc familiile generice, care pe Kobo cad pe fonturile de citire ale dispozitivului —
adică exact pe niște fonturi de carte.

```
Display / titluri:  Georgia, "Times New Roman", serif
Corp și date:       "Helvetica Neue", Helvetica, Arial, sans-serif
Cifre în tabele:    aceeași sans, cu font-variant-numeric: tabular-nums (§P7)
```

`tabular-nums` se scrie, dar nu se sprijină nimic pe el: §P7 n-a primit răspuns, deci coloana de
sume se aliniază din markup — celulă de tabel cu lățime declarată și sumele la dreapta — și
rămâne dreaptă și dacă fontul dispozitivului ignoră proprietatea.

Împărțirea serif/sans din `DESIGN.md` se păstrează, fiindcă e jumătatea identității care
supraviețuiește. Ce cade: italicul de garnitură (un serif de sistem în italic la 300ppi nu are
eleganța lui Playfair, deci nu câștigă nimic) și majusculele cu `letter-spacing` pentru titluri
de secțiune — spațierea pozitivă pe un ecran reflexiv rupe cuvântul în litere.

### Scara

Mărimile sunt date în **puncte tipografice**, fiindcă punctul e mărimea reală de pe hârtie, iar
pixelul CSS s-a dovedit a fi 1/300 dintr-un țol (§Unități). Coloana de px e derivată din
`PX_PER_PT`, nu scrisă de mână — e aici ca să se vadă ordinul de mărime, nu ca s-o copieze
cineva în foaia de stil.

| Rol | Mărime | = px | Grosime | Font |
|---|---|---|---|---|
| Cifră-erou (dashboard) | 28pt | 117px | normal | serif |
| Titlu de pagină | 20pt | 83px | normal | serif |
| Titlu de secțiune | 14pt | 58px | bold | sans |
| Corp | 12pt | 50px | normal | sans |
| Metadate, etichete | 10pt | 42px | normal | sans |
| Minim absolut | 9pt | 38px | — | nimic sub asta nu se pune pe pagină |

Cifrele din coloana a treia arată absurd pentru cineva care se uită la pagină pe un laptop, prin
cookie-ul `ui=lite`. Așa și trebuie: acolo pagina *e* de patru ori prea mare. Dispozitivul e
singurul loc unde scara asta are sensul ei, și e singurul loc unde se judecă.

Interlinie 1.45 peste tot. Hârtia electronică nu are subpixel rendering, deci literele sunt puțin
mai „subțiri" decât pe un LCD; interlinia generoasă compensează mai ieftin decât îngroșarea.

**Fără bold pe fraze întregi.** Textul îngroșat pe suprafață mare intră direct în problema
fantomelor.

---

## Geometrie, spațiere, ținte

- **O singură coloană.** Nu ca reacție la lățime, ci ca regulă: primitiva de layout pe care te-ai
  baza nu există. `display:flex` și `display:grid` lipsesc amândouă (§P2).
- **Regula de aur a layoutului rămâne, cu o singură portiță.** *Fiecare pagină trebuie să fie
  corectă dacă toate declarațiile de layout modern sunt ignorate.* Ce ține layoutul: fluxul
  normal, `<table>` pentru date chiar tabulare, și `inline-block` pentru restul. Portița e
  `display: -webkit-box` cu `-webkit-box-flex`, care **există** pe dispozitiv (§P2) — sintaxa
  din 2009, nu cea de azi. Se scrie doar ca îmbunătățire, întotdeauna după declarația care ține
  pagina fără ea, fiindcă `@supports` nu există și nu se poate întreba nimic (§P4).
- **Rază:** 0 peste tot, cu o excepție — 6px pe coperți, adică cei 2px din `DESIGN.md` trecuți
  prin §Unități. `border-radius` funcționează (§P3), dar colțurile rotunjite pe un panou fără
  antialiasing bun ies zimțate, așa că rămâne o excepție, nu un obicei.
- **Fără umbre.** `DESIGN.md` are deja „elevație prin suprafață, nu prin umbră"; aici nu există
  nici măcar suprafață alternativă. Ierarhia se face din linii și spațiu. (Motorul acceptă
  `box-shadow`, dar taie raza de estompare — §P3 — deci tot ce s-ar putea desena e un dreptunghi
  negru decalat. Încă un motiv să nu.)
- **Ținte de atingere: minimum 9mm pe latura mică**, cu 3mm între ele — adică **106px cu 35px
  între ele**. În mm în document și în px doar prin `PX_PER_MM`. 9mm e pragul sub care degetul
  ratează pe un ecran fără reacție la atingere.
- **Marginea paginii: 5mm = 59px.** Rama fizică a Libra Colour e asimetrică; nu se lipește
  conținut de muchie.
- **Cât intră pe un ecran:** 1264px, adică **17 rânduri de text de corp** la interlinie 1,45. E
  bugetul real al oricărei pagini care trebuie citită fără derulare.

---

## Componente

Fiecare intrare spune ce devine componenta existentă, nu ce ar fi frumos.

### Navigație

Bandă de legături text în partea de sus, una sub alta dacă nu încap, cu chenar de 3px fiecare.
Fără hamburger și fără sertar (§`DESIGN.md`/Meniul pe ecran îngust): sertarul are Escape, focus
prins înăuntru și fundal care închide — patru lucruri care presupun JavaScript. Șase destinații
încap ca text.

Destinația curentă e marcată cu chenar de 6px, nu cu fundal plin.

### Lista de cărți (înlocuiește tabelul din S1.2)

Nu e tabel. `DESIGN.md` spune deja că sub `xl` tabelul devine fișe (§D34), iar Kobo e sub prag:
1212px măsurați (§P1). La 300ppi, nouă coloane ar fi oricum de negândit — corpul de literă care
le-ar face să încapă e sub minimul absolut.

O fișă pe carte, separate prin linie orizontală de 3px:

```
[copertă]  Titlul cărții, pe două rânduri maxim
 15×22mm   Autorul · 2024
 177×260   «Citesc»  ★★★★☆
           43% — pag. 143 din 330
```

- **Coperta la 15×22mm — adică 177×260px**, cu rază de `6px`. Cei „40×60 pixeli CSS" din prima
  redactare erau scriși pentru un ecran de telefon; pe panoul ăsta ar fi un timbru de 3,4×5,1mm.
  Mărimea se dă în milimetri și de-aici încolo, din același motiv ca la tipografie.
- Titlul e legătura către pagina cărții. Toată fișa ar fi o țintă mai mare, dar o zonă activă
  fără margine vizibilă produce apăsări greșite pe care nu le poți anula ușor.
- Progresul apare doar la `Citesc`, ca în `DESIGN.md`, și **textul e primar, bara e opțională**:
  `progressLabel()` din `shared/` spune deja tot, iar bara e o suprafață plină în plus.
- 20 de cărți pe pagină (§Paginare). Cu o fișă de ~280px asta înseamnă vreo 4,5 ecrane de
  derulat cu degetul — mult, dar alternativa e de patru ori mai multă navigare. Rămâne 20 până
  se citește pe dispozitiv; dacă acolo e prea lung, 12, nu 10: o pagină trebuie să merite
  întoarsă.

### Coperți

**Deocamdată se trimit așa cum sunt stocate**, la `GET /covers/{bookId}`, aceeași adresă pe care
o folosește și aplicația React, iar browserul le scalează. Nu fiindcă e varianta bună, ci fiindcă
e varianta care nu atinge deloc backendul: prima felie de interfață Kobo se poate scrie și citi
pe dispozitiv fără să aștepte o transformare de imagini.

Prețul e scris aici ca să nu fie o surpriză, și e exact cel pe care prima redactare îl invoca
împotriva variantei ăsteia: un JPEG color de câteva sute de KB per rând pe o legătură lentă,
redimensionare pe un dispozitiv lent, și o copertă color care sub filtrul Kaleido, la 150ppi și
la 15mm lățime, iese un gri murdar. Toate trei sunt reale. Se acceptă temporar, nu se contestă.

Ce trebuie făcut ca să rămână temporar:

- **`width` și `height` explicite pe fiecare `<img>`**, în px, calculate din milimetri. Fără
  ele, o copertă care sosește târziu rearanjează lista sub degetul cuiva care tocmai a apăsat.
- **Adresa nu se schimbă când se transformă imaginile.** Varianta bună — gri, dimensionată exact,
  cu dithering aplicat pe server (§P6) — e o schimbare în `backend/src/covers/`, în spatele
  aceluiași URL. Nicio pagină de aici nu se atinge când se face.
- **Nu se compensează în CSS.** Fără filtre, fără trucuri de contrast: dacă rezultatul e urât,
  răspunsul e transformarea pe server, nu un strat de vopsea peste ea.

Formatul e JPEG sau PNG. WebP nu există pe dispozitiv (§P6), deci nu e o opțiune nici acum, nici
după transformare.

Placeholderul din S5.5 se păstrează ca idee — o „copertă" desenată, nu o iconiță lipsă — dar
devine: chenar de 3px negru, titlu cu serif centrat, autor dedesubt. Fără chenarul interior de
alamă.

### Stele

`★` și `☆` dacă dispozitivul are glifele (§P8 — **încă fără răspuns**, deci deocamdată se scrie
`4/5` în cifre). Nimic desenat cu CSS. Fără jumătăți, ca în S2.3. Întrebarea se pune o dată, pe
prima pagină reală care ajunge pe dispozitiv: dacă apare pătratul gol în loc de stea, s-a
răspuns.

### Grafice

`DESIGN.md` cere bare verticale cu tooltip la hover. Pe Kobo nu există hover, deci **tooltipul nu
se înlocuiește, ci se elimină, iar informația din el urcă în pagină.** Un grafic fără tooltip pe
care scrie totul e mai bun decât unul interactiv la care nu ajungi.

Bare **orizontale**, o linie per lună: eticheta la stânga, bara la mijloc, valoarea la dreapta.
Orizontal fiindcă eticheta se citește pe orizontală — pe verticală ar trebui rotită sau
prescurtată, și e chiar problema pe care rotirea cotoarelor o are deja.

```
Ian 2026  ████████████░░░░░░░░  142,00 lei
Feb 2026  ██████░░░░░░░░░░░░░░   71,50 lei
```

- Umplerea barei: negru; restul: `fillQuiet`. Fără culoare de serie — nu mai există serii de
  distins, e o singură mărime.
- Bugetul lunar rămâne o **adnotare**, nu o a doua serie: o linie verticală punctată peste bare,
  etichetată o singură dată deasupra.
- **Implementarea e SVG inline, randat pe server.** Proba a arătat că SVG-ul inline se desenează
  corect (§P9), deci varianta cu `<div>`-uri procentuale nu mai e necesară și nu se scrie „ca
  plasă de siguranță": două implementări ale aceluiași grafic înseamnă una care nu se mai
  uită nimeni la ea.
- Numărul de cărți excluse din lipsă de date rămâne sub grafic, ca în `DESIGN.md`.

### Cifrele din dashboard

Se păstrează aproape neschimbate: cifră mare serif, etichetă mică dedesubt. Ce se schimbă — nu
mai stau pe un rând despărțit de linii verticale, ci două pe rând, din `inline-block` cu lățime
în procente. Nu din flexbox: rândul trebuie să fie corect și când nu e nimic care să-l alinieze.

### Formulare

Doar controale native, trimise cu `<form method="post">`. Validarea e a serverului, cu schemele
zod din `shared/` — aceleași care validează API-ul, deci mesajele nu pot să difere.

- Erorile se afișează **deasupra câmpului**, în text, la reîncărcarea paginii. Nu există
  validare pe măsură ce scrii.
- Valorile deja introduse se re-populează în HTML-ul răspunsului. Pe un dispozitiv unde
  tastarea e lentă, un formular golit de o eroare de validare e cel mai costisitor defect posibil.
- `<input type="date">` — §P10 **încă fără răspuns**, și nu se poate afla din script: un motor
  care nu cunoaște tipul îl raportează oricum ca text. Deci fallback-ul e regula: câmp text cu
  formatul scris în etichetă, `AAAA-LL-ZZ`, plus toleranță la parsare pe server. Chiar dacă
  selectorul nativ apare, calea asta rămâne corectă.
- `<select>` pentru genuri și statusuri — lista e controlată (§D17), deci se potrivește.

### Dialoguri

Nu există. Fiecare dialog din aplicație devine o pagină cu adresă proprie: editarea, ștergerea
(cu pagină de confirmare), pornirea lecturii. `Modal.tsx` și `focus-trap.ts` nu au corespondent.

Confirmarea ștergerii e pagină întreagă cu două butoane distanțate — cu atingere imprecisă,
„Anulează" și „Șterge" nu stau alături.

### Paginare

Legături `‹ Înapoi` / `Înainte ›` cu chenar, **și sus și jos**, plus „pagina 2 din 7" între ele.
Sus și jos fiindcă butoanele fizice nu derulează, iar o listă de 20 de fișe cere derulare cu
degetul până jos.

Fără derulare infinită. Fără antet lipicios — `position: sticky` chiar lipsește (§P3), dar chiar
dacă ar exista tot n-ar avea ce căuta aici: un element care rămâne pe loc în timp ce restul se
schimbă e un element care lasă fantome.

---

## Autentificare: împerechere prin cod

§D37 lăsa întrebarea deschisă. Se închide aici, fiindcă e prima pagină pe care o vede
dispozitivul și deci prima care trebuie desenată.

**Fluxul obișnuit cu Google nu se poate folosi pe dispozitiv.** Google refuză consimțământul în
browsere pe care le consideră nesigure, iar unul din 2013 e exact cazul. Nu e o problemă de
stilizare și nu se rezolvă cu un `<meta>`.

**Decizia: Kobo-ul afișează un cod, aprobarea se dă în aplicația React.**

1. Pe Kobo, o pagină fără câmpuri arată un cod scurt și cere să fie aprobat de pe alt dispozitiv.
2. Pe laptop sau telefon, într-o sesiune deja autentificată, se tastează codul și se aprobă.
3. Pe Kobo se apasă **„Am aprobat, continuă"**, iar serverul pune cookie-ul de sesiune pe
   dispozitiv și duce mai departe.

Trei lucruri de design ies din asta, și fiecare e o consecință a mediului, nu o preferință:

- **Direcția e dictată de tastatură.** Codul apare pe Kobo și se tastează pe laptop, nu invers.
  Tastarea pe un ecran e-ink cu latență de o clipire e cea mai scumpă interacțiune din tot
  produsul; se mută pe dispozitivul unde e gratuită. Kobo-ul nu tastează nimic — apasă o dată.
- **Nu există așteptare automată.** Fără JavaScript nu se poate întreba serverul dacă a venit
  aprobarea, iar `<meta http-equiv="refresh">` — care ar funcționa — ar reîmprospăta ecranul la
  câteva secunde, la nesfârșit, cu o clipire de fiecare dată. O legătură apăsată o dată costă o
  clipire în total. Deci pagina așteaptă un tap, nu un ceas.
- **Codul se citește, nu se descifrează.** Cifre și litere mari, la mărimea cifrei-erou (117px),
  grupate câte trei cu spațiu între grupuri, fără caracterele care se confundă la citit. E singura
  informație de pe acea pagină, deci ocupă pagina.

Pagina de așteptare are și o ieșire: un cod expiră, iar un cod expirat trebuie să se poată
înlocui cu o legătură, nu cu o repornire a browserului.

Ce se schimbă în afara acestui workspace — tabelul de coduri și rutele — e treaba `backend/`-ului
și a aplicației React; aici se descrie doar ce se vede.

---

## Mișcare

**Zero.** Fără tranziții, fără animații, fără `prefers-reduced-motion` (nu are ce reduce). Orice
mișcare pe hârtie electronică e o secvență de clipiri.

---

## Buget de pagină

- **HTML + CSS inline ≤ 50KB** per pagină, coperți excluse. Foaia de stil e inline în document,
  nu într-un fișier separat: o cerere în plus pe o legătură lentă costă mai mult decât octeții
  duplicați.
- **Coperțile sunt în afara bugetului și, deocamdată, peste el.** Cât timp se trimit
  netransformate (§Coperți), o listă de 20 de fișe poate cere câțiva megaocteți de imagini. E
  cea mai mare datorie tehnică a suprafeței și singura cifră din document care nu respectă
  propriul principiu.
- **Zero JavaScript** în paginile aplicației. `/probe` e singura excepție, și acolo scriptul e
  subiectul paginii.
- **Zero cereri către alte gazde.** Nicio copertă direct de la Open Library — trec prin modulul
  `covers` (§D18).

---

## Anti-tipare

Lucruri care par pe direcția bună și nu sunt:

- **Reproducerea temei întunecate.** Cea mai probabilă alunecare, fiindcă *este* identitatea
  produsului. Vezi argumentul de la început: nu e reproductibilă, iar încercarea costă contrast.
- **Culoare Kaleido pe suprafețe mici.** Text colorat, iconițe colorate, pastile colorate. Sub
  filtru, la 150ppi, ies mai rău decât negrul.
- **Gri deschis pentru linii și text secundar.** Reflexul de pe web; aici dispare la dithering.
- **Butoane doar cu iconiță.** Fără hover nu există tooltip, iar o iconiță de 24px pe un ecran
  fără culoare e o ghicitoare — și 24px aici înseamnă 2mm, adică nimic. Text, întotdeauna.
- **Suprafețe negre mari** — antete pline, rânduri selectate inversate, butoane pline. Fantome.
- **Orice depinde de flexbox sau grid** ca să fie corect, nu doar ca să fie mai frumos —
  inclusiv de `-webkit-box`, care există dar rămâne o îmbunătățire.
- **`@supports` și proprietățile personalizate.** Nu există niciuna (§P4). O foaie de stil care
  întreabă ce poate motorul primește tăcere, iar ce e scris în blocul ăla nu se aplică niciodată.
- **Orice valoare în px copiată de undeva** fără să treacă prin §Unități. E de trei ori mai mică
  decât cel care a scris-o credea.
- **`<meta http-equiv="refresh">`** ca să afli dacă s-a schimbat ceva pe server. Funcționează, și
  costă o clipire de fiecare dată — vezi §Autentificare.
- **Dialoguri, sertare, acordeoane** — toate presupun JavaScript și o reîmprospătare parțială.
- **Derulare infinită** și antete lipicioase.
- **Fonturi descărcate**, inclusiv „doar pentru titluri".
- **Un al doilea sistem de design.** Dacă o regulă de aici nu contrazice `DESIGN.md` dintr-un
  motiv legat de mediu, atunci e o părere și trebuie scoasă.

---

## P — Ce a răspuns dispozitivul

`/probe` a rulat pe 7 august 2026. Dispozitivul se anunță
`Mozilla/5.0 (Linux; U; Android 2.0; en-us;) AppleWebKit/538.1 … (Kobo Touch 0390/4.45.23697)` —
șirul de firmware e vechi și minte modelul, dar `\bkobo\b` din `ui-choice.ts` îl prinde, ceea ce
e tot ce trebuia de la el.

| | Ce s-a măsurat | Răspuns | Ce a decis |
|---|---|---|---|
| **P1** | `window.inner`, `devicePixelRatio` | **1212×1264 px CSS, raport 1**, viewport meta onorat | 1px CSS = 1/300 țoli. §Unități, și odată cu ea toată scara documentului. |
| **P2** | `display:flex`, `-webkit-box`, `display:grid` | flex **nu**, grid **nu**, `-webkit-box` **da** | Fluxul normal ține layoutul; `-webkit-box` e îmbunătățire, niciodată dependență. |
| **P3** | `border-radius`, `box-shadow`, `position:sticky` | radius **da**, shadow **doar fără estompare**, sticky **nu** | Raza de 6px pe coperți rămâne; umbrele și antetul lipicios cad — cum cădeau oricum. |
| **P4** | Proprietăți personalizate, `@supports` | **nu**, niciuna | Tokenurile rămân în `tokens.ts`. Degradarea se scrie prin ordinea în cascadă. |
| **P5** | Mostrele de culoare, cu ochiul | „colorate, dar stinse" | Cotoarele din raft merită încercate. Pastilele de status rămân alb-negru. |
| **P6** | Rampa de gri, cu ochiul; WebP | **toate 11 treptele** se disting; WebP **nu** | Griul e util ca umplutură, nu doar ca teorie. Formatul rămâne JPEG/PNG. |
| **P7** | `tabular-nums` | **fără răspuns** — nu s-a întrebat | Fallback în vigoare: sume aliniate din markup, nu din font. |
| **P8** | Glifele `★` `☆` | **fără răspuns** | Fallback în vigoare: `4/5` în cifre. |
| **P9** | `inline SVG` | **da** | Graficele sunt SVG randat pe server, fără a doua implementare. |
| **P10** | `<input type="date">` | **fără răspuns**, și nu se poate afla din script | Fallback în vigoare, permanent: text `AAAA-LL-ZZ`. |
| **P11** | Prima încărcare peste HTTPS în producție | **da, funcționează** | Suprafața e livrabilă. Restul documentului are obiect. |

Raportul din care vin cifrele astea a venit printr-un tunel HTTP, nu prin producție — P11 s-a
confirmat separat, direct pe dispozitiv.

**Cele trei rânduri fără răspuns nu blochează nimic.** Fiecare avea un fallback scris dinainte,
iar fallback-ul e acum regula, nu o variantă de rezervă: se schimbă doar dacă dispozitivul
contrazice ceva ce se vede cu ochiul pe o pagină reală.
