# Bookcsi — Acces MCP prin OAuth 2.1

Plan de implementare pentru expunerea bibliotecii ca **server MCP** (Model Context Protocol),
astfel încât un asistent AI — Claude Desktop, Claude Code, sau orice alt client MCP — să poată
citi și modifica datele contului cu acordul explicit al utilizatorului.

Documentul e normativ pentru implementare. Deciziile de model rămân în
[DECISIONS.md](DECISIONS.md), stories-urile în [USER_STORIES.md](USER_STORIES.md); ce se
stabilește aici se mută acolo la momentul implementării, ca §D38 și Sprint 9.

---

## 1. Decizie

**API-ul devine simultan server MCP și *resource server* OAuth 2.1, cu propriul
*authorization server* montat peste autentificarea Google existentă.** Clientul e
**preînregistrat**, nu înregistrat dinamic: emitem o singură pereche `client_id` /
`client_secret`, publicată în documentație, pe care utilizatorul o lipește în dialogul de
conector al asistentului.

Transportul e **Streamable HTTP**, pe o singură rută (`POST /mcp`). Nu se implementează
transportul HTTP+SSE mai vechi.

### Alternative respinse

**Token personal (PAT) lipit într-un header.** A fost planul inițial și a fost abandonat:
funcționează cu clienți în care utilizatorul editează un fișier de configurare (Claude Code),
dar dialogurile de tip „adaugă un conector, lipește un URL" n-au unde să pună un header
propriu. Ar fi însemnat două mecanisme de autentificare întreținute în paralel pentru a acoperi
aceiași clienți pe care OAuth îi acoperă singur.

**Dynamic Client Registration (RFC 7591).** Ar scuti utilizatorul de lipit două valori, dar
adaugă un endpoint public de înregistrare și un tabel care crește necontrolat cu fiecare client
care atinge serverul. Câmpurile *OAuth Client ID* și *OAuth Client Secret* din dialogul de
conector există exact pentru serverele fără DCR. Adăugarea lui ulterioară e aditivă — metadata
de authorization server capătă un `registration_endpoint` și nimic din ce se construiește aici
nu se rescrie.

**Acceptarea token-ului Google ca token MCP.** Interzisă explicit de specificația MCP
(*token passthrough*), și pe bună dreptate: un token emis pentru alt *audience* nu dovedește
nimic despre cine l-a cerut și pentru ce resursă. Google rămâne ce e și azi — sursa de
identitate a omului — iar credențialul pe care îl acceptă API-ul e emis tot de API, la fel ca
sesiunea din §D20.

---

## 2. Relația cu deciziile existente

**§D20 rămâne neatins.** Decizia spune că *sesiunea* nu se transportă printr-un header
`Authorization`, iar `sessionCookieExtractor` are un test care o apără
(`backend/src/auth/strategies/jwt.strategy.spec.ts`). Motivul e XSS: un token citibil din
JavaScript e un token furabil dintr-o pagină. Token-ul MCP nu trăiește niciodată într-un
browser — îl ține procesul clientului — deci raționamentul nu i se aplică. Sunt două
credențiale diferite, pe două uși diferite: cookie-ul deschide `/books`, `/stats`, restul
API-ului; token-ul MCP deschide **exclusiv** `/mcp`. Nici unul nu-l acceptă pe celălalt.

**§D23 nu se extinde peste MCP.** `tokenVersion` există ca delogarea să însemne ceva, și
închide sesiunile de pe toate dispozitivele. Dacă ar guverna și accesul MCP, o delogare de pe
telefon ar rupe tăcut conectorul din Claude, iar utilizatorul n-ar avea cum să lege cauza de
efect.

**Decizie: accesul MCP se revocă separat**, dintr-un ecran propriu în setări, și supraviețuiește
delogării. Prețul e că „delogare" nu mai înseamnă „am închis tot" — de aceea ecranul de
revocare trebuie să listeze conectorii activi cu `lastUsedAt`, ca starea să fie vizibilă, nu
dedusă.

---

## 3. Fluxul

```
Claude                          api (AS + RS)                    Google
  │                                  │
  ├── POST /mcp (fără token) ───────►│
  │◄── 401 + WWW-Authenticate ───────┤  resource_metadata="…/.well-known/…"
  │                                  │
  ├── GET /.well-known/oauth-protected-resource ──►│
  │◄── { resource, authorization_servers } ────────┤
  ├── GET /.well-known/oauth-authorization-server ►│
  │◄── { authorization_endpoint, token_endpoint } ─┤
  │                                  │
  ├── browser: GET /oauth/authorize ►│  (client_id, PKCE S256, resource, state)
  │                                  ├─ validează, parchează cererea
  │                                  └─ redirect ──► web /mcp/consent?req=…
  │                                          │
  │                                          ├─ fără sesiune? ──► login Google ──┐
  │                                          │◄─────────────────────────────────┘
  │                                          └─ „Aprobi?" ──► POST …/approve
  │                                  │◄───────────────────────────────────────────┤
  │◄── redirect: <redirect_uri>?code=… ──────┤
  │                                  │
  ├── POST /oauth/token ────────────►│  (code, code_verifier, client_id+secret)
  │◄── { access_token, refresh_token } ──────┤
  │                                  │
  ├── POST /mcp + Bearer ───────────►│  JSON-RPC: initialize / tools/list / tools/call
```

**Ecranul de consimțământ e în frontend, nu în backend.** `GET /oauth/authorize` validează
parametrii, salvează cererea și trimite browserul la o rută React. Motivele: ruta are nevoie de
sesiune, iar frontendul știe deja să trimită la login și să revină; și pentru că un al doilea
mecanism de randare HTML în backend ar duplica exact ce face `frontend/`. Backendul nu randează
nimic — la aprobare returnează URL-ul de redirect, iar frontendul navighează.

---

## 4. Endpoint-uri

| Rută | Auth | Ce face |
|---|---|---|
| `GET /.well-known/oauth-protected-resource` | publică | RFC 9728. Returnează `resource` și `authorization_servers`. |
| `GET /.well-known/oauth-authorization-server` | publică | RFC 8414. Endpoint-urile, metodele PKCE (`S256` singura), grant-urile suportate. |
| `GET /oauth/authorize` | publică | Validează `client_id`, `redirect_uri`, `code_challenge`, `resource`. Parchează cererea, redirect spre consimțământ. |
| `GET /oauth/authorize/:req` | sesiune | Detaliile cererii, pentru ecranul de consimțământ: nume client, permisiuni cerute. |
| `POST /oauth/authorize/:req/approve` | sesiune | Emite codul, returnează URL-ul de redirect. Aici se leagă grant-ul de `userId`. |
| `POST /oauth/token` | client | `authorization_code` și `refresh_token`. Verifică secretul clientului și `code_verifier`. |
| `POST /oauth/revoke` | client | RFC 7009. Revocă grant-ul. |
| `POST /mcp` | Bearer | Transportul MCP. `401` + `WWW-Authenticate` fără token valid. |

Rutele `/.well-known/*` trebuie servite de **API**, nu de frontend, iar proxy-ul din față
trebuie să le rutez acolo — altfel descoperirea eșuează înainte să înceapă.

`GET /oauth/authorize` **nu** cere sesiune. Dacă ar cere, un utilizator nelogat ar primi 401 în
locul unui login. Sesiunea se cere abia la `:req` și `approve`, unde frontendul o poate obține.

---

## 5. Model de date

Trei entități noi. Clientul **nu** e o entitate — e configurație (§6).

### `McpGrant`
Consimțământul unui utilizator pentru un client. Unitatea de revocare.

| Câmp | Tip |
|---|---|
| `id` | cuid |
| `userId` | fk → `User`, `onDelete: Cascade` |
| `clientId` | text |
| `scope` | text |
| `label` | text, nullable — numele dat de utilizator conectorului |
| `createdAt` | timestamp |
| `lastUsedAt` | timestamp, nullable |
| `revokedAt` | timestamp, nullable |

### `McpAuthCode`
Codul de autorizare. Viață scurtă, o singură folosire.

| Câmp | Tip |
|---|---|
| `id` | cuid |
| `codeHash` | text, unic — `sha256` |
| `grantId` | fk → `McpGrant` |
| `codeChallenge` | text — PKCE, doar `S256` |
| `redirectUri` | text — cel exact din cerere, reverificat la schimb |
| `resource` | text |
| `expiresAt` | timestamp — **60 de secunde** |
| `usedAt` | timestamp, nullable |

### `McpToken`
Access și refresh, în același tabel, discriminate prin `type`.

| Câmp | Tip |
|---|---|
| `id` | cuid |
| `grantId` | fk → `McpGrant`, `onDelete: Cascade` |
| `type` | enum: `ACCESS`, `REFRESH` |
| `tokenHash` | text, unic — `sha256` |
| `expiresAt` | timestamp |
| `replacedById` | fk → `McpToken`, nullable — lanțul de rotație |
| `createdAt` | timestamp |

**Token-uri opace, nu JWT-uri.** Un JWT semnat s-ar valida fără interogare, dar n-ar putea fi
revocat înainte de expirare — exact problema pe care §D23 a trebuit s-o rezolve cu un contor.
Interogarea nu costă nimic în plus: `JwtStrategy` lovește oricum rândul la fiecare cerere.
`sha256` e suficient și e singura variantă care permite căutare indexată; bcrypt ar fi lent
degeaba peste un secret de 32 de octeți aleatori.

**Access: 1 oră. Refresh: 90 de zile, cu rotație la fiecare folosire.** Un refresh deja folosit,
prezentat a doua oară, înseamnă că cineva ține o copie: se revocă **întreg grant-ul**, nu doar
token-ul. Fără rotație, un refresh scurs e acces permanent.

---

## 6. Configurație

| Variabilă | Rol |
|---|---|
| `API_ORIGIN` | URL-ul public al API-ului. Intră în documentele de metadata și în `aud`. Nu se deduce din `Host` — un header controlat de client n-are ce căuta într-un identificator de resursă. |
| `MCP_CLIENT_ID` | Identificatorul public al clientului. |
| `MCP_CLIENT_SECRET` | Secretul. Comparat cu `timingSafeEqual`, niciodată cu `===`. |
| `MCP_REDIRECT_URIS` | Listă separată prin virgulă. Potrivire **exactă**, fără prefixe și fără wildcard. |

`MCP_REDIRECT_URIS` e configurație, nu constantă, fiindcă URI-ul de redirect al asistentului nu
e sub controlul nostru și se poate schimba. Se citește din documentația conectorului sau din
prima cerere `/oauth/authorize` respinsă.

Toate patru sunt obligatorii, fără valori implicite, în `backend/src/config/env.ts` — pentru
același motiv ca `NODE_ENV`: o configurație de securitate absentă nu trebuie să producă tăcut
varianta permisivă.

---

## 7. Integrarea în Nest

**`JwtAuthGuard` global nu poate proteja `/mcp`.** Ruta poartă `@Public()`, iar autentificarea
se face înăuntru, printr-un guard propriu care validează Bearer-ul, încarcă grant-ul și pune
`userId` pe request. Motivul nu e comoditate: o singură cerere HTTP transportă mai multe apeluri
JSON-RPC, iar lanțul de guard-uri nu vede nimic din ele.

**Corpul cererii e deja consumat.** Express a parsat JSON-ul înainte ca transportul MCP să-l
vadă, deci `transport.handleRequest(req, res, req.body)` — cu al treilea argument. Fără el,
transportul așteaptă un stream golit și cererea atârnă.

**Transport fără stare, instanță per cerere.** `McpServer` și transportul se construiesc la
fiecare cerere, cu `userId` capturat în closure. Elimină nevoia de `AsyncLocalStorage`, elimină
starea de sesiune server-side, și funcționează neschimbat dacă API-ul ajunge vreodată pe mai
multe procese. `@CurrentUser()` nu funcționează în handler-ele de unelte — decoratorul citește
`request.user` prin pipeline-ul de parametri, care nu rulează acolo.

**Throttling pe grant, nu pe IP.** Cele două ferestre din `AppModule` numără per adresă
(`short`: 25/s). Un client care lansează apeluri paralele dintr-o singură adresă le atinge
imediat, iar în cazul unui conector găzduit adresa e comună mai multor utilizatori. `/mcp`
primește un throttler propriu, cu cheia derivată din `grantId`.

**Validare de `Origin`.** Specificația o cere ca protecție împotriva DNS rebinding. E separată
de CORS-ul din §D20, care rămâne exact cum e — `/mcp` nu se apelează dintr-un browser.

---

## 8. Suprafața de unelte

Serviciile primesc deja `userId` ca argument și controllerele sunt subțiri, deci uneltele sunt
învelișuri peste `BooksService`, `StatsService`, `BudgetService`, `OpenLibraryService` și
`ChallengesService`. Schemele de intrare se iau din `shared/` — aceleași `zod` care validează
REST-ul.

| Unealtă | Serviciu |
|---|---|
| `search_library` | `BooksService.list` — filtre pe status, gen, favorite, text; rând subțire, **fără** `description` |
| `get_book` | `BooksService.findOne` — cartea întreagă, inclusiv `description` și `review` |
| `add_book` | `BooksService.create` |
| `update_book` | `BooksService.update` — inclusiv status, progres, `description` (§D40) și `review` (§D48) |
| `delete_book` | `BooksService.remove` |
| `get_reading_stats` | `StatsService` |
| `get_budget` | `BudgetService` |
| `search_open_library` | `OpenLibraryService.search` |
| `list_challenges` | `ChallengesService.list` — rezumat, fără cărțile complete |
| `get_challenge` | `ChallengesService.findOne` — cu cărțile ei |
| `create_challenge` | `ChallengesService.create` |
| `update_challenge` | `ChallengesService.update` — titlu, descriere, termen |
| `delete_challenge` | `ChallengesService.remove` |
| `add_book_to_challenge` | `ChallengesService.addBook` — idempotentă |
| `remove_book_from_challenge` | `ChallengesService.removeBook` — idempotentă |

**Un singur scope, `library`, cu drepturi depline** — inclusiv ștergere. E biblioteca proprie a
utilizatorului și separarea citire/scriere ar cere un al doilea flux de consimțământ pentru un
câștig teoretic. Adăugarea unui scope `library:read` mai târziu e aditivă: o coloană deja
existentă și o ramură la înregistrarea uneltelor.

**Descrierile spun *când*, nu doar *ce*.** „Call this when the user asks what they are reading
now" e măsurabil mai bună decât „Lists books", fiindcă modelul alege unealta din descriere.
Fiecare unealtă spune și ce **nu** face, ca să nu fie aleasă în locul vecinei. Răspunsurile
conțin câmpurile necesare răspunsului, nu rândul întreg — fiecare câmp în plus e context
consumat degeaba.

**Descrierile sunt în engleză, deși interfața are două limbi** (§D44). Ele nu sunt citite de un
om, ci de un model: sunt instrucțiuni de rutare, iar treaba lor e să fie potrivite cu o cerere
formulată în orice limbă. Modelul le citește la fel de bine pe amândouă, deci traducerea lor ar
dubla suprafața care trebuie ținută sincronizată — două copii ale aceleiași îndrumări, fiecare
liberă să divergă — fără nimic în schimb. Ecranul de consimțământ, pe care îl aprobă un om, se
traduce ca orice alt ecran.

**`description` e cazul în care regula de mai sus chiar contează** (§D40). E proză, până la 5000
de caractere, și e singurul câmp al cărții care poate fi mai lung decât tot restul rândului la un
loc — deci `get_book` o întoarce, iar `search_library` n-o întoarce. Tot §D40: descrierea nu se
aduce de nicăieri de către bookcsi. Modelul e sursa, `update_book` e drumul, iar descrierea acelei
unelte îi spune explicit că poate căuta despre carte și în ce ton să scrie.

**`review` e a doua proză de pe carte și se comportă altfel** (§D48). E scrisă de cititor, nu de
model: unealta o expune (același `updateBookSchema.shape` ca restul câmpurilor), iar descrierea ei
spune explicit că modelul ia dictare și nu inventează. Diferența față de `description` e cine e
autorul, nu cât e de lungă — de-aia `get_book` întoarce ambele, iar `search_library` niciuna.

Limba în care o scrie s-a schimbat însă la §D44: unealta cerea un rezumat **în română**, iar acum
cere unul în limba în care utilizatorul îi scrie. Descrierea e datele lui, nu interfața noastră —
un utilizator care citește aplicația în engleză nu are motiv să primească proză românească în
propria bibliotecă. Descrierile deja salvate nu se ating.

---

## 9. Ordinea de implementare

1. **Schelet de resource server.** `API_ORIGIN` în env, cele două documente de metadata, `401`
   cu `WWW-Authenticate` pe `/mcp`. Verificabil cu `curl`: un client MCP ajunge până la ecranul
   de login și se oprește acolo, ceea ce e progresul așteptat.
2. **Migrarea Prisma** pentru cele trei entități.
3. **Authorization server.** `/oauth/authorize`, ecranul de consimțământ în frontend,
   `/oauth/token` cu ambele grant-uri, rotația refresh-ului și detecția de reutilizare.
   Testabil integral cu `supertest`, fără client MCP.
4. **Transportul MCP** plus două unelte de citire (`search_library`, `get_book`). Prima
   conectare reală dintr-un asistent. Aici se validează perechea `client_id` / `client_secret`
   și URI-ul de redirect.
5. **Restul uneltelor**, inclusiv cele de scriere.
6. **Ecranul de revocare** în setări: conectori activi, `lastUsedAt`, buton de revocare.
7. **Documentație pentru utilizator** — URL, `client_id`, `client_secret`, pașii din dialogul
   de conector.

Pașii 1–3 n-au nevoie de niciun client MCP ca să fie testați, iar pasul 4 e primul care poate
eșua din motive aflate în afara codului nostru. Ordinea e aleasă ca acel eșec să apară cu tot
restul deja verificat.

---

## 10. Verificări de securitate

- PKCE `S256` obligatoriu; `plain` refuzat.
- `redirect_uri` — potrivire exactă cu lista, la autorizare **și** la schimbul de cod.
- Cod de autorizare: 60 de secunde, o singură folosire, legat de `code_challenge`.
- Refresh rotit la fiecare folosire; reutilizarea revocă grant-ul.
- `aud` validat pe fiecare cerere `/mcp` — un token emis pentru altă resursă se refuză.
- Secretele nu se loghează niciodată: `Authorization` și corpul lui `/oauth/token` se exclud
  explicit din orice log.
- Peste TLS exclusiv. `TRUST_PROXY` trebuie setat corect, altfel throttler-ul și logurile văd
  adresa proxy-ului.

---

## 11. Rămâne deschis

- **Numele afișat al clientului** în ecranul de consimțământ. Cu client preînregistrat nu vine
  din `/register`, deci e configurație — sau o listă scurtă, dacă apar mai mulți clienți.
- **Mai mulți clienți.** Structura suportă `clientId` per grant, dar configurația descrie unul
  singur. Al doilea client înseamnă trecerea de la variabile de mediu la un tabel — sau DCR.
- **Rutarea `/.well-known/*`** prin proxy-ul din față, împreună cu regulile existente de
  alegere a interfeței.
