# kobo-frontend

Al doilea frontend al aplicației: HTML randat pe server, fără JavaScript de
client, pentru browserul unui Kobo Libra Colour. Motivele — de ce Express și nu
Nest, de ce aceeași origine, de ce rutare după User-Agent — sunt în §D37 din
`docs/DECISIONS.md`.

Deocamdată aici există o singură pagină reală: `/probe`.

## De ce întâi o pagină de diagnostic

Nimeni nu publică ce motor are un Libra Colour, iar tabelele de User-Agent din
forumuri se opresc la dispozitive din 2012. Varianta „presupunem o linie de
bază și aflăm pagină cu pagină ce am greșit" costă mai mult decât o pagină care
întreabă dispozitivul direct. Tot ce se scrie de aici încolo se scrie pe baza a
ce raportează `/probe`.

Pagina e utilă și dacă motorul nu poate rula deloc scriptul: jumătatea randată
pe server — anteturi, decizia de rutare, mostrele vizuale — apare oricum, iar
absența celeilalte jumătăți e ea însăși rezultatul cel mai important.

## Rulare

```bash
cp kobo-frontend/.env.example kobo-frontend/.env
npm run dev:kobo
```

Implicit pe `http://localhost:4000/probe`.

## Cum ajunge pe dispozitiv

Kobo-ul trebuie să vadă mașina de dezvoltare în rețea, deci `localhost` nu
ajută. Ia adresa din LAN:

```bash
hostname -I | awk '{print $1}'
```

Pe Kobo: **Mai multe → Beta Features → Web Browser**, apoi tastează
`http://ADRESA:4000/probe`. Merită încărcată de două ori — prima oară cookie-ul
de probă încă nu s-a întors, deci rândul lui spune „nu" în mod normal.

## Cum ajunge raportul înapoi

Nu există copy-paste de pe Kobo, deci pagina se trimite singură. Jos de tot pe `/probe` e un
buton „Trimite raportul": un tap îl duce printr-un POST obișnuit de formular la
`POST /probe/report`, care scrie un fișier JSON în `kobo-frontend/reports/` — pe aceeași mașină
pe care rulează serverul de dezvoltare. Fișierul poartă anteturile cererii, cookie-urile după
nume (niciodată valoarea lor — acolo stă JWT-ul de sesiune), toate rândurile pe care le-a stabilit
scriptul ES3 (trimise ca inputuri ascunse, populate în momentul în care fiecare rând se
calculează) și răspunsurile la întrebările de judecată vizuală, care nu pot fi automatizate.

`kobo-frontend/reports/` e în `.gitignore` — sunt capturi brute de pe un dispozitiv anume, nu
sursă de proiect. După ce apeși „Trimite raportul" pe Kobo, spune-i sesiunii care lucrează la
asta să citească fișierul cel mai recent din folder; nu trebuie transcris nimic manual.
`GET /probe/reports` listează ce s-a strâns până acum, ca sanity-check de pe dispozitiv.

## Ce se notează din raport

Lista completă, cu ce decide fiecare măsurătoare și ce se face dacă răspunsul e „nu", e tabelul
`§P` de la finalul lui `docs/kobo_design.md`. Pe scurt, în ordinea în care contează:

1. **Ajunge cererea?** Dacă browserul nu deschide pagina peste HTTPS în
   producție, discuția despre CSS nu mai are obiect — stiva TLS e prea veche.
2. **`px per CSS inch` și `window.inner`.** Ecranul e 1264×1680 la 300ppi. Dacă
   dispozitivul raportează pixeli fizici la raport 1, orice mărime din foaia de
   stil trebuie recalculată.
3. **Ce sintaxă parsează.** Decide dacă `/probe` rămâne singura pagină cu
   script sau dacă se poate scrie ceva interactiv.
4. **Flexbox, grid, SVG inline.** Decid layout-ul și dacă graficele pot fi SVG
   randat pe server în loc de tabele cu bare.
5. **Scara de gri și culorile, cu ochiul liber.** Câte trepte se disting și cât
   de departe ajung culorile de gri pe Kaleido — nimic din asta nu se poate
   detecta din cod.

## Comutatorul de interfață

Rutarea după User-Agent ar face interfața asta imposibil de deschis de pe un
laptop, așa că un cookie o poate fixa manual:

- `/ui/lite` — fixează interfața Kobo
- `/ui/full` — fixează aplicația React
- `/ui/auto` — înapoi la detecție

Proxy-ul trimite `/ui/*` aici indiferent ce interfață ar alege altfel, altfel
`/ui/full` ar fi inaccesibil de pe un dispozitiv fixat pe lite.

## Reguli pentru codul de aici

- **Zero logică de business.** Ce trebuie calculat vine din API sau din
  `shared/`. Două frontend-uri care calculează același lucru diverg.
- **Fără motor de șabloane.** `src/lib/html.ts` e un tagged template care
  escapează tot; e verificat de `tsc` ca orice alt cod, ceea ce un `.hbs` n-ar
  fi.
- **Scriptul din `probe-script.ts` rămâne ES3.** Un detector scris în
  funcționalitățile pe care le detectează nu raportează nimic. Există un test
  care păzește regula.
