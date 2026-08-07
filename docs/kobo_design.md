# Bookcsi pe Kobo — sistem de design

Sistemul de design al suprafeței Kobo (§D37). Se citește **peste** `DESIGN.md`, nu în locul lui:
ce nu e contrazis aici rămâne valabil.

**Documentul e provizoriu prin construcție.** Nimeni nu publică ce poate motorul unui Libra
Colour, deci orice număr care depinde de dispozitiv e marcat cu o referință `§P…` către lista de
la final. Acele valori se recalculează după prima rulare a lui `/probe`, nu se apără. Restul —
principiile, ce se păstrează din identitate și ce se aruncă — nu depinde de dispozitiv și
rămâne.

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
| Cromatica vine din coperți | **Cade.** Coperțile ajung în tonuri de gri (§P6). Nu mai există „pată de culoare" de apărat. |
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
   locul umpluturii**: un buton cu chenar de 1px și text negru, nu un dreptunghi plin.
3. **Fără hover.** Nu există stare intermediară între „nu ating" și „am apăsat". Orice informație
   ascunsă în spatele lui hover e informație pierdută — inclusiv tooltipurile de pe grafice, pe
   care `DESIGN.md` le cere implicit.
4. **Atingere imprecisă și lentă.** Ținte mari, distanțate, cu etichetă text.
5. **Butoanele fizice de pagină nu derulează paginile web.** Derularea se face cu degetul, deci
   listele lungi se paginează.
6. **Lățime mică.** Ecranul e 1264×1680 la 300ppi, dar în pixeli CSS iese mult mai îngust
   (§P1) — de ordinul unui telefon. O singură coloană, peste tot.
7. **Culoarea e la 150ppi, sub un filtru.** Jumătate din rezoluția cernelii negre, și stinsă.

---

## Culoare

### Cerneală și suprafețe

Nu există proprietăți personalizate în foaia de stil (§P4), deci „tokenurile" nu sunt variabile
CSS. Stau într-un modul TypeScript (`kobo-frontend/src/lib/tokens.ts`) și se interpolează în
`<style>`-ul inline al paginii. Un singur loc de schimbat, verificat de `tsc`, fără să depindă
de o funcționalitate a motorului.

| Rol | Valoare | Unde |
|---|---|---|
| `inkPrimary` | `#000000` | tot textul citit |
| `inkSecondary` | `#4A4A4A` | metadate, etichete — **niciodată sub 14pt** |
| `inkMuted` | `#6E6E6E` | podeaua absolută; doar text ≥ 14pt, niciodată cifre |
| `rule` | `#000000` | separatoare, chenare — 1px, negru, nu gri |
| `fillQuiet` | `#DCDCDC` | umplere de bară, fundal de rând alternativ |
| `surface` | `#FFFFFF` | fundal, singurul |

Trei reguli care contrazic instinctele de pe web:

- **Griurile medii se folosesc pentru umpluturi, nu pentru text.** Panoul are 16 trepte de gri,
  dar browserul le obține prin dithering: un gri mediu întins e o textură, nu o culoare. La
  suprafață mare se vede; la corp de literă mic distruge conturul.
- **Liniile sunt negre, nu gri deschis.** Un chenar `#E0E0E0` de 1px poate dispărea complet după
  dithering. `DESIGN.md` folosește `--border` discret fiindcă acolo cardurile s-ar topi; aici
  problema e inversă.
- **Fără transparență.** Pastilele din `DESIGN.md` au fundaluri `rgba(...,.14)`; pe hârtie
  electronică asta produce un gri imprevizibil. Se scriu culori opace.

### Status

Culorile de status din `DESIGN.md` sunt rezervate și poartă întotdeauna și textul. Regula a doua
salvează situația: **eticheta text e deja obligatorie, deci se poate scoate culoarea fără să se
piardă informație.**

Pe Kobo statusul e o pastilă cu chenar de 1px negru, text negru, fundal alb — iar canalul
redundant devine **stilul chenarului**, nu culoarea:

| Status | Chenar | Notă |
|---|---|---|
| Wishlist | punctat | „încă nu e a ta" |
| Cumpărat | continuu subțire | |
| Citesc | continuu gros (2px) | singurul îngroșat: e starea activă |
| Terminat | dublu | |
| Abandonat | punctat, text `inkSecondary` | singura pastilă cu cerneală mai stinsă |

Culoarea Kaleido **nu** se folosește aici. O pastilă are 60–80px lățime; la 150ppi, sub filtru,
o culoare pe o suprafață atât de mică iese ca un gri murdar cu franjuri, adică mai rău decât
alb-negru curat. Vezi §P5 înainte de a schimba asta.

### Unde are voie culoarea să apară

Doar acolo unde suprafața e mare, plată, și culoarea nu poartă singură informația. Candidați,
în ordinea în care merită încercați după probe:

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

Împărțirea serif/sans din `DESIGN.md` se păstrează, fiindcă e jumătatea identității care
supraviețuiește. Ce cade: italicul de garnitură (un serif de sistem în italic la 300ppi nu are
eleganța lui Playfair, deci nu câștigă nimic) și majusculele cu `letter-spacing` pentru titluri
de secțiune — spațierea pozitivă pe un ecran reflexiv rupe cuvântul în litere.

### Scara

Mărimile sunt date în **puncte tipografice**, nu în pixeli CSS, exact fiindcă raportul dintre
cele două e necunoscut până la probe (§P1). Conversia se face o dată, când se știe.

| Rol | Mărime | Grosime | Font |
|---|---|---|---|
| Cifră-erou (dashboard) | 28pt | normal | serif |
| Titlu de pagină | 20pt | normal | serif |
| Titlu de secțiune | 14pt | bold | sans |
| Corp | 12pt | normal | sans |
| Metadate, etichete | 10pt | normal | sans |
| Minim absolut | 9pt | — | nimic sub asta nu se pune pe pagină |

Interlinie 1.45 peste tot. Hârtia electronică nu are subpixel rendering, deci literele sunt puțin
mai „subțiri" decât pe un LCD; interlinia generoasă compensează mai ieftin decât îngroșarea.

**Fără bold pe fraze întregi.** Textul îngroșat pe suprafață mare intră direct în problema
fantomelor.

---

## Geometrie, spațiere, ținte

- **O singură coloană.** Nu ca reacție la lățime, ci ca regulă: nu există primitivă de layout pe
  care să te poți baza (§P2).
- **Regula de aur a layoutului:** *fiecare pagină trebuie să fie corectă dacă toate declarațiile
  `display:flex` și `display:grid` sunt ignorate.* Se pot pune, ca îmbunătățire; nimic nu depinde
  de ele. Ce ține layoutul: fluxul normal, `<table>` pentru date chiar tabulare, și
  `inline-block` pentru restul.
- **Rază:** 0 peste tot, cu o excepție — 2px pe coperți, ca în `DESIGN.md`. Colțurile rotunjite
  pe un panou fără antialiasing bun ies zimțate; iar dacă `border-radius` lipsește (§P3), un
  design care nu se bazează pe el nu observă.
- **Fără umbre.** `DESIGN.md` are deja „elevație prin suprafață, nu prin umbră"; aici nu există
  nici măcar suprafață alternativă. Ierarhia se face din linii și spațiu.
- **Ținte de atingere: minimum 9mm pe latura mică**, cu 3mm între ele. În mm și nu în px, din
  același motiv ca la tipografie (§P1). 9mm e pragul sub care degetul ratează pe un ecran fără
  reacție la atingere.
- **Marginea paginii: 5mm.** Rama fizică a Libra Colour e asimetrică; nu se lipește conținut de
  muchie.

---

## Componente

Fiecare intrare spune ce devine componenta existentă, nu ce ar fi frumos.

### Navigație

Bandă de legături text în partea de sus, una sub alta dacă nu încap, cu chenar de 1px fiecare.
Fără hamburger și fără sertar (§`DESIGN.md`/Meniul pe ecran îngust): sertarul are Escape, focus
prins înăuntru și fundal care închide — patru lucruri care presupun JavaScript. Șase destinații
încap ca text.

Destinația curentă e marcată cu chenar de 2px, nu cu fundal plin.

### Lista de cărți (înlocuiește tabelul din S1.2)

Nu e tabel. `DESIGN.md` spune deja că sub `xl` tabelul devine fișe (§D34), iar Kobo e sub `xl`
în orice ipoteză de conversie (§P1).

O fișă pe carte, separate prin linie orizontală de 1px:

```
[copertă]  Titlul cărții, pe două rânduri maxim
 40×60     Autorul · 2024
           «Citesc»  ★★★★☆
           43% — pag. 143 din 330
```

- Coperta la 40×60 pixeli CSS, cu `2px` rază.
- Titlul e legătura către pagina cărții. Toată fișa ar fi o țintă mai mare, dar o zonă activă
  fără margine vizibilă produce apăsări greșite pe care nu le poți anula ușor.
- Progresul apare doar la `Citesc`, ca în `DESIGN.md`, și **textul e primar, bara e opțională**:
  `progressLabel()` din `shared/` spune deja tot, iar bara e o suprafață plină în plus.
- 20 de cărți pe pagină (§Paginare).

### Coperți

Trimise de server deja **gri, dimensionate exact și dithering aplicat** (§P6). Trei motive:
recolorarea în browser nu există fără JS, redimensionarea pe dispozitiv e lentă și urâtă, iar un
JPEG color de 300KB pe o legătură lentă e cel mai scump lucru de pe pagină.

Placeholderul din S5.5 se păstrează ca idee — o „copertă" desenată, nu o iconiță lipsă — dar
devine: chenar de 1px negru, titlu cu serif centrat, autor dedesubt. Fără chenarul interior de
alamă.

### Stele

`★` și `☆` dacă dispozitivul are glifele (§P8). Dacă nu: `4/5` în cifre. Nimic desenat cu CSS.
Fără jumătăți, ca în S2.3.

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
- Implementarea e SVG inline dacă probele o permit, altfel `<div>`-uri cu lățime în procente
  (§P9). Ambele arată identic; decizia e de implementare, nu de design.
- Numărul de cărți excluse din lipsă de date rămâne sub grafic, ca în `DESIGN.md`.

### Cifrele din dashboard

Se păstrează aproape neschimbate: cifră mare serif, etichetă mică dedesubt. Ce se schimbă — nu
mai stau pe un rând despărțit de linii verticale, ci una sub alta sau două pe rând, fiindcă
rândul cere flexbox.

### Formulare

Doar controale native, trimise cu `<form method="post">`. Validarea e a serverului, cu schemele
zod din `shared/` — aceleași care validează API-ul, deci mesajele nu pot să difere.

- Erorile se afișează **deasupra câmpului**, în text, la reîncărcarea paginii. Nu există
  validare pe măsură ce scrii.
- Valorile deja introduse se re-populează în HTML-ul răspunsului. Pe un dispozitiv unde
  tastarea e lentă, un formular golit de o eroare de validare e cel mai costisitor defect posibil.
- `<input type="date">` aproape sigur nu există (§P10): câmp text cu formatul scris în etichetă,
  `AAAA-LL-ZZ`, plus toleranță la parsare pe server.
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

Fără derulare infinită. Fără antet lipicios — `position: sticky` poate lipsi (§P3), și un element
care rămâne pe loc în timp ce restul se schimbă e un element care lasă fantome.

---

## Mișcare

**Zero.** Fără tranziții, fără animații, fără `prefers-reduced-motion` (nu are ce reduce). Orice
mișcare pe hârtie electronică e o secvență de clipiri.

---

## Buget de pagină

- **HTML + CSS inline ≤ 50KB** per pagină, coperți excluse. Foaia de stil e inline în document,
  nu într-un fișier separat: o cerere în plus pe o legătură lentă costă mai mult decât octeții
  duplicați.
- **Zero JavaScript** în paginile aplicației. `/probe` e singura excepție, și acolo scriptul e
  subiectul paginii.
- **Zero cereri către alte gazde.** Nicio copertă direct de la Open Library — trec prin modulul
  `covers` (§D18), care le și transformă.

---

## Anti-tipare

Lucruri care par pe direcția bună și nu sunt:

- **Reproducerea temei întunecate.** Cea mai probabilă alunecare, fiindcă *este* identitatea
  produsului. Vezi argumentul de la început: nu e reproductibilă, iar încercarea costă contrast.
- **Culoare Kaleido pe suprafețe mici.** Text colorat, iconițe colorate, pastile colorate. Sub
  filtru, la 150ppi, ies mai rău decât negrul.
- **Gri deschis pentru linii și text secundar.** Reflexul de pe web; aici dispare la dithering.
- **Butoane doar cu iconiță.** Fără hover nu există tooltip, iar o iconiță de 24px pe un ecran
  fără culoare e o ghicitoare. Text, întotdeauna.
- **Suprafețe negre mari** — antete pline, rânduri selectate inversate, butoane pline. Fantome.
- **Orice depinde de flexbox sau grid** ca să fie corect, nu doar ca să fie mai frumos.
- **Dialoguri, sertare, acordeoane** — toate presupun JavaScript și o reîmprospătare parțială.
- **Derulare infinită** și antete lipicioase.
- **Fonturi descărcate**, inclusiv „doar pentru titluri".
- **Un al doilea sistem de design.** Dacă o regulă de aici nu contrazice `DESIGN.md` dintr-un
  motiv legat de mediu, atunci e o părere și trebuie scoasă.

---

## P — Ce așteaptă rezultatele de la `/probe`

Fiecare intrare spune ce se măsoară, ce decide, și ce se face dacă răspunsul e „nu".

| | Măsurătoare | Decide | Dacă nu |
|---|---|---|---|
| **P1** | `px per CSS inch`, `window.inner` | Conversia pt→px și mm→px din tot documentul. Fără ea, toată scara tipografică e o presupunere. | — (răspunsul e un număr, nu un da/nu) |
| **P2** | `display:flex`, `-webkit-box`, `display:grid` | Dacă flexbox se poate folosi ca îmbunătățire. | Layoutul e deja construit să nu depindă de el; nu se schimbă nimic. |
| **P3** | `border-radius`, `box-shadow`, `position:sticky` | Raza de 2px pe coperți; antet lipicios. | Colțuri drepte; antetul rămâne nelipicios oricum. |
| **P4** | Proprietăți personalizate CSS | Dacă tokenurile pot fi variabile CSS în loc de interpolare din TypeScript. | Rămân în `tokens.ts`, ceea ce oricum e varianta verificată de `tsc`. |
| **P5** | Mostrele de culoare, cu ochiul | Dacă pastilele de status și cotoarele pot purta culoare. | Totul rămâne alb-negru; §Status funcționează deja fără culoare. |
| **P6** | Rampa de gri, cu ochiul; `imagine WebP` | Câte trepte de gri sunt utile la coperți; ce format trimite modulul `covers`. | JPEG gri, 4 trepte de dithering. |
| **P7** | `tabular-nums`, vizual pe o coloană de sume | Alinierea coloanei de bani. | Se scriu sumele cu lățime fixă în markup (padding cu spații fine). |
| **P8** | Glifele `★` `☆` | Stelele de rating. | `4/5` în cifre. |
| **P9** | `inline SVG` | Graficele ca SVG randat pe server. | `<div>`-uri cu lățime în procente; același aspect. |
| **P10** | `<input type="date">` (de încercat pe dispozitiv, nu din script) | Câmpurile de dată. | Text `AAAA-LL-ZZ`, cu parsare tolerantă pe server. |
| **P11** | Prima încărcare peste HTTPS în producție | Dacă suprafața e livrabilă. | Nimic din documentul ăsta nu contează; se trece la varianta PNG randat pe server. |

**P11 e primul.** Celelalte zece descriu cum arată paginile; P11 decide dacă vor exista.
