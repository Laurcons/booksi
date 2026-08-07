# Conectarea unui asistent AI la Bookcsi

Ghid de utilizator: cum conectezi Claude Desktop, Claude Code sau orice alt
client MCP la biblioteca ta din Bookcsi, ca asistentul să poată citi și
modifica biblioteca la cererea ta explicită.

Detaliile tehnice ale implementării sunt în [MCP.md](MCP.md); documentul de
față e doar pașii, din perspectiva cuiva care apasă butoane, nu care scrie cod.

---

## 1. Ce îți trebuie înainte să începi

Trei valori, de la persoana care administrează instanța ta de Bookcsi (dacă
ești tu însuți, sunt în `backend/.env`):

| Ce | Unde-l găsești |
|---|---|
| **URL-ul API-ului** | `API_ORIGIN` din configurație — de exemplu `https://api.bookcsi.exemplu.ro` |
| **OAuth Client ID** | `MCP_CLIENT_ID` |
| **OAuth Client Secret** | `MCP_CLIENT_SECRET` |

Astea trei sunt aceleași pentru orice asistent te conectezi — Bookcsi are un
singur client preînregistrat (nu unul distinct per persoană sau per
dispozitiv), așa că valorile nu sunt un secret personal, dar tot n-ar trebui
împărtășite public: oricine le are poate cere unui utilizator autentificat
în Bookcsi să aprobe un conector cu numele lui.

Ai nevoie și de un cont Google cu care ești deja autentificat (sau te poți
autentifica) în Bookcsi — accesul MCP se leagă de contul tău, nu de o parolă
separată.

---

## 2. Claude Desktop / Claude Code

1. Deschide dialogul de conectori (*Settings → Connectors → Add custom
   connector*, sau echivalentul din clientul tău).
2. La **URL server**, pune URL-ul API-ului urmat de `/mcp` — de exemplu
   `https://api.bookcsi.exemplu.ro/mcp`.
3. Clientul detectează automat că serverul cere OAuth și îți arată câmpurile
   **OAuth Client ID** și **OAuth Client Secret**. Completează-le cu valorile
   de la pasul 1.
4. Confirmă. Se deschide browserul:
   - dacă nu ești autentificat în Bookcsi, ajungi mai întâi la ecranul de
     login cu Google;
   - apoi la ecranul „X vrea acces la biblioteca ta" — verifică numele
     asistentului și apasă **Aprobă**.
5. Browserul te redirectează înapoi la client, care confirmă conectarea.

De acum, asistentul poate căuta, adăuga, modifica și șterge cărți din
biblioteca ta, și poate citi statisticile de lectură și bugetul — la cererea
ta explicită, niciodată pe cont propriu.

---

## 3. Ce poate face asistentul, concret

Opt unelte, câte una pentru fiecare acțiune din bibliotecă:

- caută în bibliotecă (după status, gen, favorite)
- vezi detaliile unei cărți
- adaugă, modifică sau șterge o carte
- statistici de lectură (cărți terminate, pagini citite, nota medie)
- buget și cheltuieli
- caută pe Open Library, pentru cărți pe care nu le ai încă

Nu există un mod „doar citire" separat — aprobarea de la pasul 2.4 dă acces
complet, ștergere inclusă. Dacă vrei să limitezi ce face asistentul, spune-i
explicit ce să nu facă în conversație; nu e (încă) o restricție tehnică.

---

## 4. Revocarea accesului

Din Bookcsi: click pe avatarul tău din colțul din dreapta sus →
**Aplicații conectate**. De acolo vezi fiecare conector activ, când a fost
folosit ultima dată, și poți revoca oricare dintre ele cu un click.

Revocarea e imediată — următoarea cerere a asistentului, oricât ar fi de
curând, primește un refuz. Delogarea din Bookcsi **nu** revocă și accesul
MCP; sunt două lucruri separate intenționat (vezi §2 din MCP.md).

Poți reconecta oricând același asistent, reluând pașii de la secțiunea 2 —
nu se creează un conector nou, cel vechi e reactivat.

---

## 5. Dacă ceva nu merge

- **„redirect_uri is not registered for this client"** — clientul tău
  folosește un URI de redirect diferit de cel configurat în `MCP_REDIRECT_URIS`
  pe server. Cere administratorului să-l adauge (§6 din MCP.md).
- **„invalid_client"** — Client ID sau Client Secret greșit, sau copiat cu un
  spațiu în plus.
- **Ajungi la ecranul de login în buclă** — sesiunea din Bookcsi a expirat;
  autentifică-te din nou cu Google în tab-ul care s-a deschis.
- **Asistentul spune că nu găsește nicio unealtă** — verifică la pasul 2.2 că
  URL-ul se termină în `/mcp`, nu doar cu adresa API-ului.
