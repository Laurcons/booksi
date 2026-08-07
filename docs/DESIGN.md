# Bookcsi — Filozofie de design

Referința vizuală sunt capturile din materialul de marketing ChapterLog. Preluăm **atmosfera**,
nu produsul: numele, logo-ul, textele și compoziția lor de marketing le aparțin. Ce ne interesează
e temperatura, tipografia și felul în care e tratată coperta de carte.

Ce **nu** e referință: interfața Instagram din jurul capturilor, bara de countdown, badge-urile de
ofertă, bokeh-ul dens și reflexiile de pe mockup-urile de laptop. Alea sunt ambalaj publicitar.
Produsul din mijlocul imaginii e sobru — de acolo luăm.

---

## Spiritul, într-o frază

**O bibliotecă la lumina lumânării.** Cald, întunecat, liniștit, cu alamă pe muchii și cu
tipografie de carte tipărită. Nu „dashboard de analytics pe fundal negru" — negrul nostru are
maro în el, nu albastru.

Trei consecințe care se aplică peste tot:

1. **Cromatica vine din coperți, nu din interfață.** Asta e regula centrală. Șasiul aplicației e
   maro-închis și alamă, aproape monocrom. Singura culoare saturată din ecran o dau coperțile
   cărților. De-aia grila din galerie funcționează: 30 de coperți colorate pe un fundal cald și
   stins arată ca un raft, nu ca un feed.
2. **Tipografia face eleganța, nu efectele.** Serif cu contrast mare pentru titluri, sans curat
   pentru date. Fără gradiente pe text, fără umbre lungi, fără glow.
3. **Densitate mică.** Marginile generoase și liniile de tabel discrete sunt cele care fac
   diferența dintre „jurnal" și „foaie de calcul".

---

## Temă

**Dark-only în MVP.** Tema întunecată caldă *este* identitatea produsului; o variantă light ar fi
o a doua identitate, nu o preferință. Nu construim toggle până nu există cerere reală.

Consecință: nu punem `prefers-color-scheme` și nu scriem CSS condiționat pe temă. Un singur set
de tokenuri.

---

## Culoare

Toate valorile de mai jos sunt verificate: contrastele de text cu `surface-1`, iar paleta de
grafice cu validatorul din skill-ul dataviz (`validate_palette.js`, mod dark).

### Suprafețe și cerneală

```css
:root {
  color-scheme: dark;

  /* suprafete — maro cald, nu gri neutru */
  --surface-0:      #120D0A;  /* fundal pagina */
  --surface-1:      #1A1310;  /* suprafata de baza / grafice */
  --surface-2:      #241A15;  /* card */
  --surface-3:      #2E221B;  /* card ridicat, hover, dropdown */
  --border:         #3B2C23;  /* linii de tabel, contur card */

  /* cerneala */
  --ink-primary:    #F5EFE6;  /* 16.0:1 */
  --ink-secondary:  #C9BFB2;  /* 10.1:1 */
  --ink-muted:      #8C8177;  /*  4.8:1 — minimul acceptat */

  /* alama — accentul de brand */
  --accent:         #E3B04B;  /* 9.2:1 */
  --accent-hover:   #F0C468;
  --accent-quiet:   #4A3A1E;  /* fundal pentru pastile si stari active */
}
```

`--ink-muted` e la 4.8:1. E podeaua, nu o sugestie: nu introduceți un gri mai stins pentru
„text secundar de tabel", pentru că exact acolo stau prețurile și numerele de pagini.

### Auriul de brand nu e culoare de date

`--accent` (#E3B04B) trece contrastul față de suprafață (9.2:1), deci e bun pentru text, iconuri,
stele și butoane. Dar cade **în afara benzii de luminozitate** admise pentru seriile de grafic
(L 0.48–0.67; auriul e la 0.785). Verificat, nu presupus.

Deci: aurul e cromul interfeței. În grafice, rolul „chihlimbar" e ținut de `#C98500`.

### Statusuri

Culorile de status sunt **rezervate** — nu se refolosesc niciodată ca serii de grafic. Fiecare
pastilă poartă întotdeauna și textul, deci starea nu e transmisă doar prin culoare.

| Status | Punct | Fundal pastilă |
|---|---|---|
| Wishlist | `#9085E9` | `rgba(144,133,233,.14)` |
| Cumpărat | `#3987E5` | `rgba(57,135,229,.14)` |
| Citesc | `#C98500` | `rgba(201,133,0,.16)` |
| Terminat | `#199E70` | `rgba(25,158,112,.14)` |
| Abandonat | `#8C8177` | `rgba(140,129,119,.14)` |

### Paleta categorială pentru grafice

Ordine **fixă**, atribuită în ordinea de mai jos și niciodată ciclată. Validată integral pe
`--surface-1`:

| Slot | Hex |
|---|---|
| 1 | `#3987E5` |
| 2 | `#D95926` |
| 3 | `#199E70` |
| 4 | `#C98500` |
| 5 | `#D55181` |
| 6 | `#9085E9` |

```
Lightness band    PASS   toate in L 0.48–0.67
Chroma floor      PASS
CVD separation    PASS   cea mai proasta pereche 8.4 ΔE (protan)
Normal vision     PASS   19.3 ΔE
Contrast          PASS   toate >= 3:1
```

Ordinea contează: rearanjarea sloturilor pică testul de daltonism (verde lângă magenta scade la
1.6 ΔE deutan). Dacă schimbați paleta, rulați validatorul din nou — nu vă uitați la ea.

**Genurile sunt 17, paleta are 6.** Graficele pe gen arată primele 5 și pliază restul în „Altele".
Nu se generează culori noi pentru genul al 7-lea.

### Rampa secvențială

O singură nuanță, chihlimbar, pentru magnitudine (intensitatea lunilor, heatmap de lectură):
`#3B2A0E → #6B4E12 → #9C7016 → #C98500 → #E3B04B`.

---

## Tipografie

| Rol | Font | Note |
|---|---|---|
| Display | **Playfair Display** | titluri de pagină, cifre-erou din dashboard |
| Flourish | Playfair Display *italic* | doar pentru „biblioteca ta", „raftul tău" — accente rare |
| UI / body | **Inter** | tot restul: tabele, formulare, etichete, navigație |

Reguli:

- **Cifrele din tabele și din sume folosesc `font-variant-numeric: tabular-nums`.** Coloana de
  prețuri trebuie să se alinieze pe virgulă; cu cifre proporționale, un tabel de buget arată prost
  și se citește greu.
- Titlurile de secțiune (nu cele de pagină) sunt Inter, uppercase, `letter-spacing: .08em`, în
  `--ink-muted`. Serif-ul rămâne pentru momentele mari, altfel se banalizează.
- Italicul serif e o garnitură. Maxim unul pe ecran.
- Fără text pe gradient, fără `text-shadow`. Materialul de marketing are, produsul nu.

---

## Geometrie și spațiere

- **Rază:** `4px` controale mici · `8px` inputuri, pastile, butoane · `12px` carduri și module ·
  `2px` coperțile de carte (o carte are colțuri aproape drepte).
- **Grilă de spațiere:** multipli de 4, cu 24px ca respirație implicită între module.
- **Elevație prin suprafață, nu prin umbră.** Un card e `--surface-2` pe `--surface-0`. Umbre doar
  pe overlay-uri reale (modal, dropdown), și atunci difuze și fără culoare.
- **Contur de 1px `--border` pe carduri.** Pe fundal cald-închis, fără contur cardurile se topesc.

---

## Componente

### Cardul de carte (galerie, S5.1–S5.4)

Coperta e eroul: raport 2:3, `object-fit: cover`, rază 2px, ocupă toată lățimea cardului. Sub ea,
în ordine: titlu (Inter 600, două rânduri maxim, apoi elipsă), autor (`--ink-muted`), și un rând
de metadate cu stelele și pastila de status.

- **Fără umbră colorată extrasă din copertă.** Tentant, dar strică exact regula 1 — culoarea
  trebuie să rămână în copertă.
- Steaua de favorit stă în colțul din dreapta-sus, peste copertă, pe un disc semi-transparent
  întunecat ca să rămână lizibilă indiferent de copertă.
- Bara de progres apare **doar** pe cărțile cu status `Citesc`.
- Hover: `translateY(-2px)` și conturul devine `--accent-quiet`. Atât.

### Placeholderul de copertă (S5.5)

Nu e o iconiță generică. E o „copertă" desenată de noi: fundal `--surface-3`, un chenar interior
subțire de 1px alamă la 30% opacitate, titlul cu Playfair centrat și autorul dedesubt. Trebuie să
arate ca o carte fără supracopertă, nu ca o imagine lipsă — în grilă, zeci de placeholdere goale
ar strica raftul.

### Raftul (S8.2)

**Singura suprafață deschisă la culoare din aplicație**, și e intenționat: un plan de lemn cald
(`#D9C3A5`) cu cotoare pastelate. E momentul „obiect real" al produsului și funcționează tocmai
prin contrast cu restul.

- Grosimea cotorului derivă din `totalPagini`, între 14px și 44px; cărțile fără număr de pagini
  primesc 24px. Maparea e `[80, 900] pagini → [14, 44]px`, cu tăiere la capete: proporțional cu
  zero, capătul de jos n-ar fi atins de nicio carte reală (§D33).
- Culoarea cotorului derivă din gen, dintr-o rampă pastel **decorativă**, separată de paleta de
  grafice — aici nu se citesc valori, deci nu se aplică regulile de dataviz.
- Cotoarele au titlul rotit la 90°, afișat doar când grosimea depășește 20px — prag care cade
  înăuntrul intervalului, deci se aplică efectiv (§D33).
- Cotorul e un buton, nu un dreptunghi: se ajunge la el cu tastatura, iar detaliile cărții se
  deschid și la `Enter`, nu doar la hover cu mausul.
- Raftul are o umbră subtilă sub muchie și o linie de lemn dedesubt. Fără texturi fotografice.

### Cifrele din dashboard (S8.1)

Cifră mare Playfair în `--ink-primary`, etichetă mică uppercase în `--ink-muted` dedesubt, fără
card separat pentru fiecare — un singur rând, despărțit de linii verticale `--border`. Nu e un
grafic, deci nu primește culoare de serie.

Stau sus pe `/`, deasupra tabelului, nu pe o rută proprie (§D32) — un dashboard pe care trebuie
să navighezi nu mai e „la deschiderea aplicației".

### Tabelul (S1.2)

- Fără linii verticale. Doar separatoare orizontale `--border` la 1px.
- Rândul are 56px înălțime — încape miniatura de copertă la 32×48.
- Coloanele numerice (pagini, preț) aliniate la dreapta, cu `tabular-nums`.
- Header lipicios la scroll, pe `--surface-2`.
- Hover pe rând: `--surface-2`.
- **Lățimi fixe, declarate într-un `<colgroup>` și măsurate** (§D34). Conținutul numeric, data
  și butoanele sunt `nowrap`: o coloană prea îngustă nu rupe rândul, ci îl împinge peste coloana
  vecină. Cine schimbă o celulă remăsoară coloana.
- **Sub `xl` nu există tabel**, ci fișe cu același conținut (§D34). Nouă coloane pe un telefon
  înseamnă scroll orizontal peste status și peste toate acțiunile.

### Meniul pe ecran îngust

Sub `md`, navigația e un **sertar** deschis din hamburger, nu o bară de taburi jos și nu o
bandă de pastile care se derulează lateral. Șase destinații e cu una peste cât ține confortabil
o bară de jos, iar o navigație pe care trebuie s-o tragi cu degetul e o navigație ale cărei
ultime două intrări nu le găsește nimeni.

Aceleași obligații ca la modal: Escape, fundal care închide, Tab prins înăuntru, pagina din
spate blocată, focusul întors pe hamburger. Navigarea îl închide — inclusiv prin butonul de
back al browserului, de-aia e legat de rută, nu de `onClick`-ul fiecărui link.

### Stelele

`--accent` pentru cele pline, `--border` pentru cele goale. Jumătățile de stea nu există —
scala e întreagă (§S2.3).

---

## Grafice (Sprinturile 6–7)

Se aplică metoda din skill-ul dataviz. Punctele care contează aici:

- **Buget în timp (S6.2)** — bare, nu linie. Cheltuiala lunară e o magnitudine per interval, nu o
  cantitate continuă. Capete rotunjite 4px, ancorate la linia de bază.
- **Cărți pe lună (S7.2)** — la fel, bare.
- **O singură axă.** Dacă apare vreodată dorința de a suprapune „bani cheltuiți" cu „cărți citite",
  se fac două grafice. Niciodată două scale pe același plot.
- **Grilă recesivă:** linii `--border`, doar orizontale, fără contur de plot.
- **Tooltip la hover, implicit**, pe fiecare grafic. Un grafic HTML e interactiv; unul static e o
  imagine.
- **Tooltipul numește, nu doar însumează.** Pe buget, luna își arată cele mai scumpe trei
  achiziții și numără restul („și încă 4 cărți"). Totalul spune cât a costat luna; titlurile
  spun de ce. Un „și altele" fără cifră ascunde exact ce ar trebui să spună.
- **Unitatea se scrie o dată**, ca legendă mică `--ink-muted` deasupra axei Y — nu lipită de
  fiecare tick. Cinci repetări ale aceleiași constante nu sunt informație.
- **Bugetul lunar e o linie de referință, nu o a doua serie:** punctată, în `--ink-3`, etichetată
  „buget lunar". Poartă token de text tocmai fiindcă e o adnotare peste serie, deci regula „o
  singură axă, o singură serie" rămâne întreagă. De reținut ce *nu* spune: `monthlyBudget` e o
  setare curentă, nu un istoric, deci linia înseamnă „atât îți propui să dai", nu „atât aveai
  bugetat în martie 2025".
- Domeniul axei se rotunjește în sus la o valoare pe care ar fi ales-o un om. Fixarea plafonului
  face loc liniei de buget când stă peste toate barele, dar îi ia lui Recharts alegerea
  tick-urilor, iar axa ajunge să se termine în `556.24`.
- **Textul poartă tokenuri de text**, niciodată culoarea seriei. Valorile și etichetele stau în
  `--ink-primary` / `--ink-secondary`.
- Sub fiecare grafic, numărul de cărți excluse din cauza datelor lipsă (cerut de S6.2 și S7.2), în
  `--ink-muted`.

---

## Mișcare

Discretă și scurtă: 150ms pentru hover, 200ms pentru intrarea unui panou, `ease-out`. Fără
animații de intrare pentru grila de coperți — 40 de carduri care apar în cascadă la fiecare
încărcare devin enervante după a treia vizită. Se respectă `prefers-reduced-motion`.

---

## Anti-tipare

Lucruri care par pe direcția bună și nu sunt:

- **Gri-albastru în loc de maro-închis.** Cea mai probabilă alunecare, fiindcă majoritatea
  temelor dark implicite (Tailwind `slate`, `zinc`) sunt reci. Verificați că fundalul are
  componenta roșie peste cea albastră.
- **Aur peste tot.** Alama e accent, nu suprafață. Dacă un ecran are mai mult de trei elemente
  aurii, unul dintre ele e decorativ și trebuie scos.
- **Glow și bokeh din materialul de marketing.** Alea vând produsul, nu îl compun.
- **Chenare colorate în funcție de status pe cardul de carte.** Pastila spune deja statusul;
  colorarea marginii intră în competiție cu coperta.
- **Umbre colorate sub coperți.**
- **Culoare generată programatic pentru genul al 7-lea** într-un grafic.
- **Cifre proporționale într-o coloană de bani.**
