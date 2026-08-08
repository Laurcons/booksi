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

**A doua rundă, după prima pagină reală.** `/probe` a răspuns întrebările de motor; nu putea
răspunde cum arată o pagină adevărată, cu o listă de cărți, un formular și butoane, pe hârtia
electronică din mână. Trei corecții au ieșit din uitatul la pagina aia, nu din presupuneri noi
peste `/probe`: scara tipografică era prea mare cu aproape jumătate (§Unități), o pagină care se
derulează cu degetul e o pagină mai greu de folosit decât una care încape (§Geometrie,
§Paginare), iar prudența inițială față de culoare pe suprafețe mici era mai mare decât ceruse
dispozitivul de fapt (§Culoare). Toate trei sunt corecții empirice — din ce s-a văzut, nu din ce
s-a calculat — și rămân la fel de deschise reviziei ca orice altceva de aici.

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
| Auriul de brand | **Se păstrează, restrâns.** `#E3B04B` pe butonul primar și pe reperul de navigare activă — vezi §Culoare. Nicăieri altundeva. |
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
   locul umpluturii**: un buton cu chenar de 2px și text negru, nu un dreptunghi plin — cu o
   singură excepție, butonul primar (§Culoare).
3. **Fără hover.** Nu există stare intermediară între „nu ating" și „am apăsat". Orice informație
   ascunsă în spatele lui hover e informație pierdută — inclusiv tooltipurile de pe grafice, pe
   care `DESIGN.md` le cere implicit.
4. **Atingere imprecisă și lentă.** Ținte mari, distanțate, cu etichetă text.
5. **Nicio pagină nu se derulează, nici măcar cu degetul.** Redactarea inițială spunea doar că
   butoanele fizice de pagină nu derulează, și lăsa derularea cu degetul ca soluție —
   listele lungi se paginau, dar o pagină tot putea fi mai înaltă decât ecranul. Uitatul la o
   pagină reală a arătat că regula trebuia să fie mai strictă: singura mișcare pe ecran e o
   pagină nouă, întreagă, adusă de un tap. Fiecare pagină e construită să încapă în cei 1264px
   ai ecranului (§Geometrie); ce nu încape se paginează (§Paginare), nu se derulează.
6. **Lat în pixeli, mic în mână.** Ecranul e 1264×1680 la 300ppi, iar browserul raportează exact
   acei pixeli: 1212×1264 pixeli CSS utili, la `devicePixelRatio` 1 (§P1). Nu e un viewport de
   telefon — e un viewport larg pe o suprafață de 4,2 țoli. O singură coloană rămâne regula, dar
   nu fiindcă n-ar încăpea două: fiindcă lățimea fizică și degetul n-au crescut odată cu
   numărul de pixeli.
7. **Culoarea e la 150ppi, sub un filtru.** Jumătate din rezoluția cernelii negre, și stinsă —
   confirmat cu ochiul pe dispozitiv, nu dedus (§P5).

---

## Unități: o constantă calibrată, nu doar calculată

Măsurătoarea care schimbă cel mai mult din document (§P1) — și singura corectată de două ori.
Browserul onorează `<meta name="viewport" content="width=device-width, initial-scale=1">`,
raportează `devicePixelRatio` 1 și un viewport de 1212×1264. Panoul e documentat la 300ppi.
Aritmetica directă din astea trei fapte spune:

**1 pixel CSS = 1 pixel fizic = 1/300 dintr-un țol.**

Prima redactare a documentului s-a oprit aici, iar rezultatul a fost o pagină cu tot — text,
butoane, margini — de aproape două ori mai mare decât trebuia, văzută pe dispozitiv. Faptele
măsurate de `/probe` nu erau greșite; ce era greșit era presupunerea că specificația de 300ppi a
panoului e egală cu ce folosește motorul de layout al browserului. Ceva între cele două —
un strat de compunere, filtrul de culoare Kaleido, sau un implicit al unui motor atât de vechi
care nu se vede din script — înjumătățește mărimea efectivă. Nu s-a găsit *de ce*; s-a găsit
*cât*, uitându-se la o pagină reală și corectând constanta până a arătat corect:

```ts
// kobo-frontend/src/lib/units.ts
export const PX_PER_INCH = 150; // corectat empiric — vezi comentariul din fișier
export const PX_PER_PT = PX_PER_INCH / 72; // 2,0833
export const PX_PER_MM = PX_PER_INCH / 25.4; // 5,9055
```

Exact de-aia tot documentul dă mărimile în puncte tipografice și milimetri, nu în pixeli:
raportul dintre unități a rămas neschimbat, doar constanta din care se calculează s-a mișcat, și
s-a mișcat într-un singur loc. Dacă privirea pe dispozitiv cere o a treia corecție, tot aici se
schimbă.

### Consecința care se uită ușor

Factorul față de un ecran obișnuit e acum **~1,6×** (150ppi echivalent față de 96) — redus de la
factorul de calibrare inițial, dar tot un factor real. Nu se aplică doar tipografiei: **orice
valoare în px copiată din `DESIGN.md`, sau venită din reflexul de pe web, e greșită cu același
factor.**

| Ce înseamnă pe web | Aici |
|---|---|
| linie sau chenar de 1px | **2px** |
| accent de 2px | **3px** |
| rază de 2px pe copertă | **3px** |
| corp de literă de 16px | **25px** (adică cei 12pt din §Scara) |

Un chenar scris `1px` rămâne un fir de păr și dispare la dithering. E cel mai probabil defect al
oricărei pagini scrise fără să te uiți la tabelul ăsta.

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
| `rule` | `#000000` | separatoare, chenare — 2px, negru, nu gri (§Unități) |
| `accent` | `#E3B04B` | **doar** butonul primar și reperul de navigare activă — vezi mai jos |
| `fillQuiet` | `#DCDCDC` | umplere de bară, fundal de rând alternativ |
| `surface` | `#FFFFFF` | fundal, singurul |

Trei reguli care contrazic instinctele de pe web:

- **Griurile medii se folosesc pentru umpluturi, nu pentru text.** Toate cele 11 trepte ale
  rampei de pe `/probe` s-au distins clar (§P6), deci griul e un instrument real, nu unul
  teoretic — dar el se obține prin dithering: un gri mediu întins e o textură, nu o culoare. La
  suprafață mare se vede bine; la corp de literă mic distruge conturul.
- **Liniile sunt negre, nu gri deschis.** Un chenar `#E0E0E0` de 2px poate dispărea complet după
  dithering — iar unul scris `1px` dispare oricum, indiferent de culoare (§Unități).
  `DESIGN.md` folosește `--border` discret fiindcă acolo cardurile s-ar topi; aici problema e
  inversă.
- **Fără transparență.** Pastilele din `DESIGN.md` au fundaluri `rgba(...,.14)`; pe hârtie
  electronică asta produce un gri imprevizibil. Se scriu culori opace.

### Status

Culorile de status din `DESIGN.md` sunt rezervate și poartă întotdeauna și textul. Regula a doua
salvează situația: **eticheta text e deja obligatorie, deci se poate scoate culoarea fără să se
piardă informație.**

Pe Kobo statusul e o pastilă cu chenar de 2px negru, text negru, fundal alb — iar canalul
redundant devine **stilul chenarului**, nu culoarea:

| Status | Chenar | Notă |
|---|---|---|
| Wishlist | punctat | „încă nu e a ta" |
| Cumpărat | continuu subțire (2px) | |
| Citesc | continuu gros (3px) | singurul îngroșat: e starea activă |
| Terminat | dublu | |
| Abandonat | punctat, text `inkSecondary` | singura pastilă cu cerneală mai stinsă |

Culoarea Kaleido **nu** se folosește aici, nici acum că butonul primar o poartă în altă parte a
paginii (vezi mai jos). O pastilă are 6–8mm lățime; la 150ppi, sub filtru, o culoare pe o
suprafață atât de mică iese ca un gri murdar cu franjuri, adică mai rău decât alb-negru curat.
§P5 a confirmat că mostrele de culoare se văd colorate, dar stinse — ceea ce nu schimbă nimic
aici: „se vede că e roșu" pe un pătrat de 60×44 nu înseamnă „se citește ca roșu" pe conturul unei
pastile. Diferența cu butonul primar nu e o excepție ascunsă la regula asta: e o suprafață de
altă mărime, plată și fără text de citit peste ea la corp mic — vezi mai jos de ce contează.

### Accentul de brand, restrâns la o singură acțiune pe pagină

A doua corecție empirică din §Culoare, alături de recalibrarea din §Unități: prudența inițială
excludea auriul de brand de peste tot, dedusă înainte să existe o pagină reală de privit.
Uitatul la dispozitiv a arătat loc pentru puțin mai mult decât atât — dar puțin, nu peste tot.

`accent` (`#E3B04B`, același galben pe care `DESIGN.md` îl rezervă cromului de interfață, nu
datelor — vezi acolo distincția față de `#C98500`) apare în exact două locuri:

- **Butonul primar al paginii** — unul singur, niciodată mai mult de unul: Salvează, Adaugă o
  carte, Marchează drept cumpărată, Am aprobat, continuă. Fundal plin `accent`, nu doar chenar —
  singurul loc din tot documentul unde umplutura câștigă în fața conturului (§Mediu, constrângerea
  2), fiindcă un buton cu adevărat unic pe ecran nu se confundă cu restul și nu lasă fantomă pe
  care s-o observi, fiind singura suprafață colorată din pagină.
- **Reperul de navigare activă**, în locul chenarului negru simplu — vezi §Componente/Navigație.

Nicăieri altundeva: nu pe pastile de status, nu pe text, nu pe iconițe. Diferența față de lista
„unde are voie culoarea" de mai jos e că acolo culoarea ar purta o informație (ce gen are cotorul,
cât de depășit e bugetul); aici e pur decorativă — spune „acesta e butonul care contează", ceva ce
textul deja spune, deci nimic nu s-ar pierde dacă `accent` ar rămâne, din vreun motiv, o culoare pe
care motorul n-o poate reda corect.

**Colțuri și umbră, aceeași singură excepție.** Butonul primar are și rază (§Geometrie) și o umbră
plată, fără estompare — §P3 a confirmat că `box-shadow` chiar nu poate desena o estompare pe acest
motor, deci forma nu se preface că poate: un decalaj solid, negru, ca un obiect ștampilat, nu ca o
imitație de umbră de ecran. Restul paginii rămâne drept și fără umbră, ca înainte.

### Unde are voie culoarea de date să apară

Secțiunea de mai sus a închis întrebarea pentru cromul de interfață. Asta rămâne întrebarea
deschisă pentru culoare care *poartă o informație reală* — genul unui cotor, cât de depășit e
bugetul — care e un pariu diferit și mai riscant decât un buton decorativ. Doar acolo unde
suprafața e mare, plată, și culoarea nu e singura purtătoare a informației. Proba a arătat că e
loc de încercat — culorile ajung vizibil departe de gri, chiar dacă stinse (§P5) — deci lista de
mai jos e de făcut, nu de discutat, în ordinea asta:

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
constanta care le transformă în pixeli CSS e cea calibrată empiric în §Unități. Coloana de px e
derivată din `PX_PER_PT`, nu scrisă de mână — e aici ca să se vadă ordinul de mărime, nu ca s-o
copieze cineva în foaia de stil.

| Rol | Mărime | = px | Grosime | Font |
|---|---|---|---|---|
| Cifră-erou (dashboard) | 28pt | 58px | normal | serif |
| Titlu de pagină | 20pt | 42px | normal | serif |
| Titlu de secțiune | 14pt | 29px | bold | sans |
| Corp | 12pt | 25px | normal | sans |
| Metadate, etichete | 10pt | 21px | normal | sans |
| Minim absolut | 9pt | 19px | — | nimic sub asta nu se pune pe pagină |

Cifrele din coloana a treia tot arată mari pentru cineva care se uită la pagină pe un laptop, prin
cookie-ul `ui=lite` — factorul e acum ~1,6×, nu cei ~3,1× din prima calibrare, dar tot un factor.
Dispozitivul e singurul loc unde scara asta are sensul ei, și e singurul loc unde se judecă.

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
- **Rază:** 0 peste tot, cu două excepții — 3px pe coperți (cei 2px din `DESIGN.md` trecuți prin
  §Unități) și rază mai generoasă pe **butonul primar** (§Culoare), unde e parte din decizia
  deliberată de a-l face să arate ca un obiect ștampilat, nu ca restul paginii. `border-radius`
  funcționează (§P3); pe orice altă suprafață colțurile rotunjite pe un panou fără antialiasing
  bun ies zimțate, așa că rămân o excepție, nu un obicei.
- **Fără umbre, cu aceeași excepție.** `DESIGN.md` are deja „elevație prin suprafață, nu prin
  umbră"; pe restul paginii nu există nici măcar suprafață alternativă, iar ierarhia se face din
  linii și spațiu. Motorul acceptă `box-shadow`, dar taie raza de estompare (§P3) — deci singura
  umbră care se scrie e un decalaj solid, fără estompare, și doar sub butonul primar. Oriunde
  altundeva rămâne motivul de a nu: o umbră fără estompare pe o suprafață obișnuită arată ca o
  eroare, nu ca profunzime.
- **Ținte de atingere: minimum 9mm pe latura mică**, cu 3mm între ele — adică **53px cu 18px
  între ele**. În mm în document și în px doar prin `PX_PER_MM`. 9mm e pragul sub care degetul
  ratează pe un ecran fără reacție la atingere.
- **Marginea paginii: 5mm = 30px.** Rama fizică a Libra Colour e asimetrică; nu se lipește
  conținut de muchie.
- **Cât intră pe un ecran, și de ce contează acum mai mult ca înainte:** 1264px, adică **~35 de
  rânduri de text de corp** la interlinie 1,45. Nu mai e doar bugetul unei pagini care „ar trebui"
  citită fără derulare (§Mediu, constrângerea 5) — e bugetul **fiecărei** pagini, fără excepție,
  fiindcă nicio pagină de pe această suprafață nu se mai derulează deloc. O pagină care nu încape
  în cei 1264px se rescrie sau se paginează (§Paginare); nu se lasă mai înaltă și gata.

---

## Componente

Fiecare intrare spune ce devine componenta existentă, nu ce ar fi frumos.

### Navigație

Bandă de legături text în partea de sus, una sub alta dacă nu încap, cu chenar de 2px fiecare.
Fără hamburger și fără sertar (§`DESIGN.md`/Meniul pe ecran îngust): sertarul are Escape, focus
prins înăuntru și fundal care închide — patru lucruri care presupun JavaScript. Șase destinații
încap ca text.

Destinația curentă e marcată cu chenar de 3px **auriu** (`accent`), nu cu fundal plin — singurul
loc din navigație unde culoarea de brand înlocuiește negrul simplu (§Culoare).

### Lista de cărți (înlocuiește tabelul din S1.2)

Nu e tabel. `DESIGN.md` spune deja că sub `xl` tabelul devine fișe (§D34), iar Kobo e sub prag:
1212px măsurați (§P1). La 300ppi, nouă coloane ar fi oricum de negândit — corpul de literă care
le-ar face să încapă e sub minimul absolut.

O fișă pe carte, separate prin linie orizontală de 2px:

```
[copertă]  Titlul cărții, pe două rânduri maxim
 15×22mm   Autorul · 2024
 89×130    «Citesc»  ★★★★☆
           43% — pag. 143 din 330
```

- **Coperta la 15×22mm — adică 89×130px**, cu rază de `3px`. Cei „40×60 pixeli CSS" din prima
  redactare erau scriși pentru un ecran de telefon; pe panoul ăsta, chiar și după recalibrare, ar
  fi un timbru de 6,8×10,2mm. Mărimea se dă în milimetri și de-aici încolo, din același motiv ca
  la tipografie.
- Titlul e legătura către pagina cărții. Toată fișa ar fi o țintă mai mare, dar o zonă activă
  fără margine vizibilă produce apăsări greșite pe care nu le poți anula ușor.
- Progresul apare doar la `Citesc`, ca în `DESIGN.md`, și **textul e primar, bara e opțională**:
  `progressLabel()` din `shared/` spune deja tot, iar bara e o suprafață plină în plus.
- **5 cărți pe pagină** (§Paginare) — redus de la 20, și pentru un motiv diferit de „pagina nu
  trebuie să fie prea lungă": trebuie să **încapă**, complet, fără derulare (§Mediu, constrângerea
  5). O fișă e dominată de coperta ei de 130px; cinci fișe plus titlul paginii, butonul „Adaugă o
  carte" și paginatorul de sus și de jos umplu aproape exact cei 1264px disponibili. Cifra n-a
  fost verificată cu text real pe dispozitiv — e aritmetică, nu măsurătoare — deci se tratează ca
  `PX_PER_INCH`: un prim calcul, de corectat după ce se vede o pagină adevărată.
- **Cifrele din dashboard apar doar pe prima pagină.** Repetarea lor pe fiecare pagină ar fi
  aceleași patru numere arătate din nou fără motiv, și e totodată cea mai mare parte din ce ar fi
  împins pagina a doua peste limita ecranului.

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
devine: chenar de 2px negru, titlu cu serif centrat, autor dedesubt. Fără chenarul interior de
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

**Formularele lungi se secționează — cu un script, al doilea de pe toată suprafața.** Un
formular de treisprezece câmpuri nu încape într-un ecran (§Geometrie), iar regula de a nu se
derula deloc (§Mediu, constrângerea 5) nu se putea respecta doar din HTML și CSS. §Buget de
pagină explică ce anume permite asta acum; aici e forma pe care o ia.

Pagina se randează întotdeauna întreagă: toate câmpurile, într-un singur `<form>`, împărțite în
câteva `<div class="wizard-section">` — grupuri firești (detalii, status și progres, preț și
date), nu o tăiere arbitrară la mijlocul unui câmp. **Fără JavaScript, asta e pagina**: toate
secțiunile vizibile, formularul se derulează ca orice pagină lungă dinainte de regula asta, și
funcționează identic cu ce exista înainte de scriptul din `book-form-script.ts`.

Cu JavaScript, scriptul găsește secțiunile, le ascunde pe toate mai puțin una, și adaugă
„‹ Înapoi" / „Pasul X din Y" / „Înainte ›" între ele — construite cu `document.createElement`,
nu randate de server și doar arătate, fiindcă un buton „Înainte" care nu face nimic pe un motor
fără script ar fi mai rău decât lipsa lui. Butonul de trimis rămâne acolo unde a fost dintotdeauna
— în ultima secțiune — deci nu există un al doilea loc unde formularul se poate trimite.

O singură subtilitate merita rezolvată direct în script: o eroare de validare poate ateriza în
orice secțiune, dar reîncărcarea ar arăta mereu prima. Scriptul caută secțiunea care conține de
fapt o eroare și deschide pe aceea, nu pe prima — altfel o eroare pe ultimul câmp ar fi invizibilă
până la al treilea tap.

### Dialoguri

Nu există. Fiecare dialog din aplicație devine o pagină cu adresă proprie: editarea, ștergerea
(cu pagină de confirmare), pornirea lecturii. `Modal.tsx` și `focus-trap.ts` nu au corespondent.

Confirmarea ștergerii e pagină întreagă cu două butoane distanțate — cu atingere imprecisă,
„Anulează" și „Șterge" nu stau alături.

### Paginare

Legături `‹ Înapoi` / `Înainte ›` cu chenar, **și sus și jos**, plus „pagina 2 din 7" între ele.
Motivul s-a schimbat față de prima redactare: pagina nu se mai derulează deloc (§Mediu,
constrângerea 5), deci sus și jos nu mai sunt capetele unei derulări — sunt aceeași pagină,
amândouă vizibile deodată. Rămân în ambele locuri oricum, ca țintă mai apropiată de orice punct
al ecranului ar atinge degetul mai întâi; redundanța costă puțin, iar un singur paginator ar
însemna o presupunere despre unde privește cineva.

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
- **Codul se citește, nu se descifrează.** Cifre și litere mari, la mărimea cifrei-erou (58px),
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
  netransformate (§Coperți), chiar și o pagină de 5 fișe poate cere câteva sute de KB pe copertă.
  E cea mai mare datorie tehnică a suprafeței și singura cifră din document care nu respectă
  propriul principiu.
- **JavaScript doar ca îmbunătățire, niciodată ca dependență.** Regula inițială era „zero
  JavaScript în paginile aplicației, `/probe` singura excepție" — scrisă înainte să se știe ce
  poate motorul. Raportul `/probe` a răspuns: multe metode ES5 funcționează (`addEventListener`,
  `querySelectorAll`, `createElement`/`appendChild`), dar nu și `fetch` sau `Promise`, și nicio
  sintaxă mai nouă de ES5. Regula devine, deci, în trei condiții, toate obligatorii:
  1. **ES5 confirmat, nimic mai nou.** Fără `let`/`const`, funcții săgeată, template literals,
     `class`, destructurare, spread, `async`/`await` — o eroare de parsare oprește tot scriptul,
     în tăcere.
  2. **Fără rețea din script.** Fără `fetch`, fără `Promise`. Singura cerere pe care o pagină
     cu script o face rămâne trimiterea nativă a formularului.
  3. **Pagina fără script trebuie să fie deja completă.** Scriptul se scrie *după* ce pagina fără
     el a fost verificată singură — el adaugă o secționare pe deasupra, nu repară o pagină ruptă.
  `/probe` rămâne singura pagină al cărei subiect e propriul script. `book-form-script.ts`
  (§Componente/Formulare) e a doua, și singura din restul aplicației.
- **Zero cereri către alte gazde.** Nicio copertă direct de la Open Library — trec prin modulul
  `covers` (§D18).

---

## Anti-tipare

Lucruri care par pe direcția bună și nu sunt:

- **Reproducerea temei întunecate.** Cea mai probabilă alunecare, fiindcă *este* identitatea
  produsului. Vezi argumentul de la început: nu e reproductibilă, iar încercarea costă contrast.
- **Culoare Kaleido pe suprafețe mici sau care poartă text.** Iconițe colorate, pastile colorate,
  text colorat. Sub filtru, la 150ppi, ies mai rău decât negrul — §Culoare face o singură
  excepție, deliberată și restrânsă, pentru butonul primar; nu e o portiță pentru orice altceva.
- **Gri deschis pentru linii și text secundar.** Reflexul de pe web; aici dispare la dithering.
- **Umbre cu estompare, sau mai multe umbre suprapuse ca s-o imite.** Motorul taie raza de
  estompare a `box-shadow` (§P3); o încercare de a o simula cu straturi arată mai rău decât un
  singur decalaj solid, care e forma pe care butonul primar chiar o folosește.
- **Colțuri rotunjite ca obicei, nu ca excepție numărată.** Rotunjirea a ieșit din categoria
  „niciodată" în §Geometrie, dar tot rămâne o listă scurtă și explicită (coperți, buton primar) —
  nu un stil aplicat din reflex peste tot ce arată a card.
- **Butoane doar cu iconiță.** Fără hover nu există tooltip, iar o iconiță de 24px pe un ecran
  fără culoare e o ghicitoare — și 24px aici înseamnă 2mm, adică nimic. Text, întotdeauna.
- **Suprafețe negre mari** — antete pline, rânduri selectate inversate, butoane pline. Fantome.
  Butonul primar rămâne excepția numărată din §Culoare, nu un precedent pentru mai mult.
- **Orice depinde de flexbox sau grid** ca să fie corect, nu doar ca să fie mai frumos —
  inclusiv de `-webkit-box`, care există dar rămâne o îmbunătățire.
- **`@supports` și proprietățile personalizate.** Nu există niciuna (§P4). O foaie de stil care
  întreabă ce poate motorul primește tăcere, iar ce e scris în blocul ăla nu se aplică niciodată.
- **Orice valoare în px copiată de undeva** fără să treacă prin §Unități. E greșită cu un factor
  — ~1,6× la calibrarea curentă — indiferent cine a scris-o și cât de sigur era.
- **`<meta http-equiv="refresh">`** ca să afli dacă s-a schimbat ceva pe server. Funcționează, și
  costă o clipire de fiecare dată — vezi §Autentificare.
- **JavaScript care nu lasă o pagină completă în urma lui.** Regula amendată din §Buget de pagină
  nu e o portiță generală — e trei condiții, toate obligatorii, iar „scriptul nu a rulat" trebuie
  să însemne „pagina tot funcționează", nu „pagina e stricată".
- **Dialoguri, sertare, acordeoane** — toate presupun JavaScript și o reîmprospătare parțială.
- **Derulare infinită**, antete lipicioase, și orice pagină lăsată mai înaltă decât ecranul din
  comoditate — regula de acum e că nu se derulează nimic, nu doar listele lungi.
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
| **P1** | `window.inner`, `devicePixelRatio` | **1212×1264 px CSS, raport 1**, viewport meta onorat | Aritmetica directă dădea 1px CSS = 1/300 țoli; privitul la o pagină reală a arătat că era prea mare cu aproape jumătate. `PX_PER_INCH` corectat empiric la 150 — §Unități. |
| **P2** | `display:flex`, `-webkit-box`, `display:grid` | flex **nu**, grid **nu**, `-webkit-box` **da** | Fluxul normal ține layoutul; `-webkit-box` e îmbunătățire, niciodată dependență. |
| **P3** | `border-radius`, `box-shadow`, `position:sticky` | radius **da**, shadow **doar fără estompare**, sticky **nu** | Raza rămâne excepție numărată (coperți, buton primar); umbra plată, fără estompare, intră doar sub butonul primar; antetul lipicios cade — cum cădea oricum. |
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
