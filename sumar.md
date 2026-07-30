# Sumar decizii — #25 Paginare + sortare în grid-ul Owners

Document de lucru pentru review la rece. Fiecare secțiune = o decizie luată, cu motivul din
spatele ei. Comentați direct pe rânduri în PR.

Status: **decis, neimplementat.**

---

## Context

Issue [#25](https://github.com/victorrentea/petclinic/issues/25) cere:
- grid sortabil după orice coloană
- paginare în pagini de 5, 10 sau 20 de rânduri

Constrângere adăugată în timpul discuției, care schimbă toate calculele:

> **În producție ajungem rapid la ~10.000 de owneri.**

Seed-ul de dev are 28 de owneri. Aproape orice decizie ar fi arătat altfel dacă ne uitam
doar la seed — de aceea am inspectat datele reale înainte de a alege.

---

## Ce ne-au spus datele reale

Interogat cu `node scripts/db-wo-mcp.js` pe baza locală (28 owners, 32 pets, 27 visits).
Constatările care au schimbat decizii:

| # | Constatare | Consecință |
|---|---|---|
| 1 | Adresele încep cu numărul casei: `14 Kensington…`, `221B Baker…`, `26 Rue…`, `4 Privet…`, `671 Lincoln…` | Sortarea pe `address` e semantic greșită → **nesortabilă** |
| 2 | Telefoanele sunt `text` cu prefix internațional (`0032…`, `0034…`, `0441…`); **Kevin McCallister are `telephone = NULL`** (pus de `V5__clear_demo_owner_phone.sql`) | Sortarea pe `telephone` sortează pe țară, nu pe număr → **nesortabilă** |
| 3 | Collation-ul clusterului e `C`, coloanele n-au collation propriu | Sub `C`: `Adams, Zamfir, de Vries, van Gogh, Ångström, Émile, Öztürk` — minusculele și diacriticele cad **după Z**. Sub `en-US-x-icu` iese corect. Invizibil azi, evident la 10k nume reale |
| 4 | `owners` are **un singur index**: `owners_pkey` | Fiecare pagină = sort complet la 10k rânduri |
| 5 | Chei de sortare ne-unice: `London`×7, `Hogsmeade`×3, `Darling`×2, `Potter`×2, `14 Kensington Gardens`×2 | Risc de paginare instabilă (același owner pe două pagini). **Onest: n-am reușit să-l reproduc pe 28 de rânduri** — planul e stabil accidental. E latent, apare când planul se schimbă la volum |
| 6 | `Owner.pets` și `Pet.visits` sunt `LAZY`, fără `@BatchSize`; `OwnerDto` include tot lanțul | O pagină de 20 de owneri ≈ **45+ query-uri**. Grid-ul afișează doar `pet.name`; `visits` călătoresc degeaba |
| 7 | `OwnerDto.telephone` e `@NotNull @Pattern("^[0-9]*$")`, dar datele reale au un `NULL` | Contractul declarat nu descrie datele reale. *Nu îl reparăm aici* — vezi „Rămâne pe dinafară" |

---

## Deciziile

### D1. Pornim de la zero, nu reciclăm munca veche
Există deja o implementare completă pe `feat/25-owners-grid-pagination` (commit `a942ac1`,
38 fișiere), nemergeuită și fără PR. **Nu o folosim, nici măcar ca referință.**
Pe branch-ul curent a rămas orfan `petclinic-frontend/src/app/owners/owner-page.ts` — o
interfață nefolosită de nimeni; o rescriem în cadrul acestei schimbări.

### D2. Paginare și sortare **pe server**
Nu pentru cele 28 de rânduri de azi, ci pentru cele 10.000 de mâine. Varianta client-side
(`MatTableDataSource` sortând în browser) ar fi însemnat zero schimbări de API, dar ar fi
trimis toată tabela pe fir.

### D3. Coloane sortabile: **Name** și **City**. Atât.
| Coloană | Sortabilă | De ce |
|---|---|---|
| Name | ✅ `last_name`, apoi `first_name` | Util |
| City | ✅ | Util |
| Address | ❌ | Constatarea #1 — ar sorta pe numărul casei |
| Telephone | ❌ | Constatarea #2 — ar sorta pe prefix de țară |
| Pets | ❌ | Nedefinit (număr? primul nume?) + join scump la 10k |

**Abatere conștientă de la issue.** #25 cere „sortable by *any* column"; noi livrăm 2 din 5.
Preferăm două sortări corecte în locul a patru din care două mint. Coloanele nesortabile nu
primesc săgeți de sortare — fără tooltip explicativ.

### D4. Numele se randează **„McCallister, Kevin"**
Azi scrie „Kevin McCallister" dar sortarea e după numele de familie — grid-ul ar arăta
nesortat. Ordinea afișată trebuie să fie ordinea după care se sortează.

### D5. Migrarea `V9` — collation ICU **și** indexuri
Ordinea contează: un index construit înainte de `ALTER … COLLATE` devine inutilizabil pentru
`ORDER BY … COLLATE "en-US-x-icu"`.

1. `ALTER TABLE owners ALTER COLUMN {last_name, first_name, city} … COLLATE "en-US-x-icu"`
2. `CREATE INDEX owners_last_first_idx ON owners (last_name, first_name, id)`
3. `CREATE INDEX owners_city_idx ON owners (city, id)`

`id` e inclus în index fix ca tiebreaker-ul din `ORDER BY`, ca pagina să fie servită din index
fără sort suplimentar.

⚠️ `ALTER COLUMN … COLLATE` ia `ACCESS EXCLUSIVE` și rescrie coloana — instant la 10k, dar
**nu e online**. De verificat la implementare: `findByLastNameStartingWith` face prefix-match,
care are nevoie de `text_pattern_ops` ca să folosească indexul sub ICU.

### D6. Rupem `GET /api/owners`, cu anvelopă scrisă de mână
Endpoint-ul întoarce `OwnerPageDto { content, totalElements, totalPages, number, size }` în loc
de `OwnerDto[]`. Fără endpoint paralel: varianta „lăsăm și cel vechi" ar fi păstrat în producție
exact query-ul nelimitat care ne omoară la 10k.

Blast radius verificat — **MCP-ul și chatbot-ul nu ating endpoint-ul** (folosesc repository-uri
direct). Se rup, și se actualizează: `owners.feature` („the response JSON array has size 2"),
`OwnerTest`, `BasicAuthenticationConfigTest`, `OwnerSearchThroughLatencyProxyTest`, plus
`openapi.yaml` → `npm run generate:api` → `api-types.ts`.

**Nu** serializăm direct `Page<OwnerDto>`: forma lui e instabilă între versiuni de Spring și ar
scurge în API câmpuri interne (`pageable.sort.unsorted`).

### D7. N+1: `@BatchSize` pe `Owner.pets` și `Pet.visits`
Cele ~45 de query-uri devin ~3. Două adnotări, payload neschimbat.

`JOIN FETCH` **nu** e o opțiune: Hibernate nu poate aplica `LIMIT` peste un join care multiplică
rândurile, așa că trage tot în memorie și paginează acolo (`HHH000104`) — fix dezastrul pe care
îl evităm.

Un DTO de listă fără `visits` ar fi mai curat, dar introduce un al doilea tip de owner în
frontend pentru un câștig de bandă neglijabil la 20 de rânduri/pagină. Rămâne follow-up.

**Fără test care numără query-urile** (decis explicit). Consecință acceptată: regresia N+1 nu e
blocată automat.

### D8. Sortarea se cere prin **chei de UI**, iar cheile necunoscute se ignoră
Clientul trimite `?sort=name,asc` / `?sort=city,desc`. Serverul mapează:
- `name` → `last_name, first_name, id`
- `city` → `city, id`

Nu expunem `Pageable` brut, din două motive: ar scurge numele câmpurilor din entitate în API, și
Spring rezolvă orice cale din graf — `?sort=pets.visits.description` ar genera join-uri
neaprobate, adică un query patologic declanșat dintr-un query param.

Cheie necunoscută → **cădem tăcut pe sortarea implicită**, nu 400.
⚠️ *Recomandasem 400.* Riscul asumat: un client care cere o sortare imposibilă primește date
într-o ordine diferită de cea cerută, fără să afle. E un compromis conștient pentru toleranță.

### D9. Restul (variantele recomandate, fără dezbatere)
- **Mărimi de pagină:** 5 / 10 / 20, implicit **10**.
- **Sortare implicită:** `name` ascendent.
- **Starea listei trăiește în URL** (`?page=&size=&sort=&lastName=`) — deep-link-uri
  partajabile și buton Back funcțional.
- **Căutarea după nume rămâne pe server** și se combină cu paginarea; orice căutare nouă
  **resetează la pagina 1**, altfel ai putea ateriza pe o pagină goală.
- **UI:** `MatTable` + `MatSort` + `MatPaginator` (Angular Material 16.2.1, deja în proiect),
  restilizate să arate ca tabelul Bootstrap existent. `table-layout: fixed`, ca să nu sară
  coloanele la sortare.
- **Teste:** unit pe backend (paginare, sortare, tiebreaker, cheie invalidă, collation), specs
  Angular pe componentă + service, Playwright pe navigare între pagini și sortare.
- **Docs:** `user-manual/manual.md` + screenshot regenerat.

---

## Rămâne pe dinafară (follow-up, nu în acest PR)

1. **`OwnerDto.telephone` e `@NotNull` dar datele au `NULL`** (constatarea #7). Contract
   nesincer, dar preexistent — nu-l reparăm sub umbrela paginării.
2. **DTO de listă fără `visits`** (alternativa de la D7).
3. **Test care numără query-urile**, ca protecție anti-regresie N+1 (D7).
4. **Sortare pe Address / Telephone**, dacă cineva chiar o vrea — ar necesita coloane
   normalizate (`street_name`, telefon în format E.164), nu doar un `ORDER BY`.

---

## De verificat la implementare

- `PackagesArchTest` s-ar putea plânge de dependențe noi între pachete. Dacă se întâmplă,
  **actualizăm diagrama, nu ocolim guardrail-ul.**
- `spectral lint` trebuie să treacă pe `openapi.yaml` cu noua anvelopă.
- Prefix-match sub ICU (vezi D5).
