# Ikra Meditrip – project handover

## How to run (on a machine that can reach npm)
```sh
npm install                       # first full install – see "Not yet verified"
cp .env.example .env              # fill in values
# the database is created and filled automatically on first start; `npm run db:seed` re-runs it safely
ADMIN_EMAIL=you@example.com ADMIN_NAME="You" ADMIN_PASSWORD='<12+ chars, upper/lower/digit>' npm run db:admin
npm run dev                       # http://localhost:8080 (admin at /admin)
npm test                          # 101 tests
npm run typecheck                 # full tsc with the project's strict tsconfig
npm run lint
npm run build:node                # Node server build (see Hosting)
```
Requires Node 22.5+ (uses the built-in `node:sqlite`).

## Fix log – import-protection errors
Cause: TanStack Start denies client imports from any `**/server/**` path; the RPC functions lived in `src/server/`.
Fix: `src/server/` → `src/backend/` (database, API, auth – server-only, only ever imported lazily inside `createServerFn` handlers and API routes); RPC functions → `src/lib/data-fns.ts`; shared view types → `src/lib/types.ts`. Import protection is untouched. No route imports `@/backend/*` statically.
Windows: `npm run build:node` is now cross-platform (`scripts/build-node.mjs`). Node >= 22.5 required (clear error if older).

## Verified (automated – `npm test`, strict `tsc` on server code)
- Database schema + migrations; relationships doctor↔hospital↔department↔treatment.
- Public read API with country / city / department filters, search across doctors+hospitals+treatments, menu data.
- Lead capture exactly per client form (name, age, country, city, phone, treatment, report upload): validation, honeypot, rate limiting, file-type sniffing (PDF/JPG/PNG/Word, 10 MB, 5 files), private storage, authenticated download, CSV export (formula-injection safe).
- Admin API: login (scrypt, lockout), sessions, CSRF, roles (admin / editor=content / sales=leads), full CRUD on all content, bulk CSV/JSON import with dry-run and per-row errors, audit log.
- Treatment costs are never returned publicly unless marked verified (with date); testimonials only if consented + published.
- sitemap.xml / robots.txt generation.
- Seed: 22 departments (client's 17 + 5 PROPOSED: Pulmonology, Nephrology, General & Laparoscopic Surgery, Internal Medicine, Paediatrics & Paediatric Surgery – client to confirm names), 20 hospitals, 75 doctors, 10 treatment pages (names only; no body/cost). Existing databases pick up the new departments, treatments and doctor links by running `npm run db:seed` (safe to repeat; only back-fills links to the 5 new departments).
- Homepage shows the client's original 17 speciality cards; "View All" lists all 22.
- Treatment pages with no linked doctors/hospitals show the department's, labelled as such.
- Doctor↔hospital: `npm run db:mapping` writes `data/templates/doctor-hospital-mapping.csv` (75 doctors, hospitals column blank) + `hospital-slugs.csv`. Client fills `hospitals` (slugs separated by `|`, first = primary), then Admin → Import (dry-run first). Re-import tested.
- Windows EPERM on test cleanup: cause was the never-closed shared SQLite connection (+ -wal/-shm files). Added `closeDb()`; tests close it before deleting temp folders, with bounded `rmSync` retries (5×100 ms).

Also verified: first start auto-fills an empty database (22 departments, 20 hospitals, 75 doctors, 10 treatments); homepage data (17 partnered hospitals in the client order, doctors with photos, logo carousel list, footer links data); hospital↔doctor editing keeps a doctor's primary hospital.

## Written but NOT yet compiled or run (npm registry was blocked in my environment)
All React/TanStack code: public pages (home banner+filters, about, departments, treatment pages, doctors and hospitals lists + profiles, treatment-cost, blog, search), multi-level menu, floating WhatsApp/call/cost CTA, lead form, admin UI, JSON-LD, canonical tags. Syntax-checked only. Expect a short round of fixes on first `npm run dev`/`build`, mainly TanStack Start API details (`createServerFn().inputValidator`, `server.handlers`, `ssr:false`, `doctors_.$slug` route naming).

## Hosting – decision needed
The project was generated for Lovable/Cloudflare. The database and file uploads need a **Node.js host with a writable disk** (`build:node` sets `NITRO_PRESET=node-server`). Plain PHP/WordPress shared hosting cannot run this. If the host is MySQL-only, the data layer (`src/backend/repo`) must be ported.

## Content placeholders (not invented)
Costs, bios, testimonials, blog posts, doctor→hospital links, doctor experience, hospital photos/descriptions: empty until supplied. Hospital cards show the bundled stock image labelled "Representative image". Department descriptions are the earlier generic copy and need clinical sign-off.


## Update – hero slider, logo, e-mail, feedback, blogs, footer
- **Hero**: right-hand form removed; left content, search and filters unchanged. Background is a cross-fading slider (`src/components/site/HeroSlider.tsx`) of the 3 client photos in `public/hero/` (800 px + large WebP). Pauses on hover/focus, honours "reduce motion", dots + arrows, readability overlay. The cost form remains in the "Talk to a patient coordinator" section (`#appointment`) and on /treatment-cost and the floating button.
- **Logo**: client logo in `public/brand/` used in header and footer (the old Lovable-only `/__l5e/...` URL no longer used).
- **Footer**: white strip came from a global 5.5 rem `body` bottom padding plus a 96 px footer top margin; both removed (clearance for the floating buttons is now inside the footer's own background).
- **Enquiry e-mail** (`src/backend/lib/mailer.ts`, no new dependency): every lead is saved first; the e-mail to `LEAD_NOTIFY_TO` (default Contactus@ikrameditrip.com) is then attempted over TLS (STARTTLS on 587 or implicit TLS on 465; certificates verified; refuses plain-text credentials). The real outcome is stored per lead (`sent / failed / not_configured`) and shown in Admin → Leads, with "Try sending again". Without `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` the admin shows "not configured"; nothing is faked. Medical reports are NOT attached to e-mails (privacy) – download them in the admin. Set the variables in `.env` (see `.env.example`). Existing databases get the new columns automatically.
- **Patient feedback**: premium carousel (`Testimonials.tsx`). Shows genuine testimonials only when published AND consent-confirmed in the admin; until then 3 cards labelled **Demo** with no names/ratings/claims (`src/data/demo-testimonials.ts`).
- **Blogs**: 3 original articles seeded (`src/backend/seed-posts.ts`), editable in Admin → Posts. Detail pages have SEO title/description, canonical, BlogPosting JSON-LD, "Keep reading" links and internal links to departments/hospitals/doctors/cost form. Content has no prices, statistics or guarantees – **have your medical/editorial team review before publishing**. Cover images are the client hero photos.
- Run `npm run db:seed` on an existing database to add the posts (idempotent; never overwrites admin edits).

## Supplied doctor profiles, hospital images & 25 departments (latest update)

**What was loaded** (idempotent `seed()` → `applySuppliedDoctors`, `applyHospitalImages`; admin edits are never overwritten):
- Source: DOCTORS.docx (155 profiles, photos, bios), doctor_list_excel.xlsx (152 names → speciality columns + city), 14 TX Hospitals profile cards. Generated data: `src/data/supplied-doctors.ts`; photos in `public/doctors/`, cards in `public/doctors/cards/`.
- 169 supplied profiles: **72 already existed** (matched by normalised name; only empty fields filled, hot-linked photos replaced by the supplied local photo), **97 added**. Library total 172 doctors, no duplicate names/slugs. A doctor under two specialities is one record linked to both departments.
- 25 departments = the 22 earlier + Cosmetic & Plastic Surgery, Dermatology & Cosmetology, Prosthetic & Artificial Body Parts (names taken from the Excel columns — **client to confirm**). Homepage still shows the original 17 cards.
- 20 hospital photos from the supplied folder are assigned by name (`public/hospitals/<slug>.webp`). Two hospitals named in the doctor files but absent from the list were added with a labelled placeholder: Fortis Hospital Kolkata, PHS Fertility Centre Kolkata.
- Homepage "Know our best doctors" = 24 curated profiles (photo, speciality, description); set once (`app_meta` key `supplied_profiles_v1`), change via admin "featured".

**Still needs the client:** hospital for 68 doctors (none linked — never guessed); correct bios for Dr Himanshu Pratap and Dr Meera Luthra (bios in the docx belong to other people → withheld); photo for Dr Mohsin Khan; experience years (not supplied for anyone); 8 profiles without qualification, 16 without description; Manipal image↔city (Bangalore/Electronic City/Siliguri) confirmation; Appaji Krishnan K "Apollo Hospital, Chennai" is ambiguous (unlinked); 3 near-identical photos (Soumya Kanti Bag, Rajarshi Mitra, Sourav Dutta); photos/details for the 2 new hospitals; 3 legacy doctors in neither source (Navin Chobdar, Bhaskar S, Jagadeesh C).
Migration 4 adds `doctors.city`, `doctors.profile_card_url`, `app_meta`.

## Header / hero / hospital descriptions fix
- Hero: two slides pointed at non-existent `-1060.webp` files (broken images); now use the existing `-1600.webp` files.
- Header: full menu from `xl` (≥1280px) so "Contact" is no longer cut off; below that the hamburger menu is used. Departments and Doctors menus show 12 items + "View all" (`MENU_LIMIT` in Header.tsx), also on mobile. Duplicate mobile "Home" link removed.
- Hospitals: every hospital has a short description (hospitals.summary, set by `npm run db:seed` — run it once on an existing database; admin-written text is never overwritten). Cards show the description instead of the old one-word tag.
- Patient feedback: unchanged and ready — add entries in Admin → Testimonials (tick Published + Consent); the labelled demo cards disappear automatically once one real entry is published.
- Header (final): the design is the original one (tagline, 'Know your cost' button, same gaps/fonts). Only the container is wider (max-w-7xl) and the full menu starts at 1280px (hamburger below), because at the old 1152px container width Contact was pushed under the button. Rendered in headless Chromium at 1280–1600px (also with +0.35px letter-spacing to mimic the wider Plus Jakarta font): no overlap (>=65px spare), no horizontal overflow, Departments flyout and Doctors/Hospitals panels inside the viewport.
