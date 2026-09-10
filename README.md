# Home Health Compass · Operations Platform prototype

An interactive, client-presentation prototype of the Phase 1 **HHC Operations Platform**: referrals and visit requests, clinician communication, credentials and billing in one application, with two experiences (Office Staff and Clinician) working on the same demo data.

Built with React 18, TypeScript and Vite. No backend, no UI framework: plain CSS with brand tokens adapted from the PureLogics presentation design system (navy, electric blue, signature green, Sen + Inter). Everything is fictional demo data and every change is stored in the browser only.

## Quick start

Live demo: https://salmanasif-pm.github.io/hhc-prototype/

```bash
npm install
npm run dev          # http://localhost:5173
npm test             # unit tests for eligibility, matching, assignment, billing, export
npm run build        # type-check + production build into dist/
npm run preview      # serve the production build on http://localhost:4173
npm run smoke        # optional: browser walkthrough of both journeys against the preview
                     # (needs: npm i -D playwright && npx playwright install chromium)
```

Node 20 or newer.

## Deployment (static hosting)

The build is a relocatable static site (`base: './'`) that uses hash routing, so deep links such as `…/#/office/billing` and browser refresh work on any static host without server rewrite rules.

- **GitHub Pages**: the `deploy-pages` workflow builds and publishes `dist/` on every push to `main` (and on demand from the Actions tab). Pages source must be "GitHub Actions" (Settings > Pages); the workflow attempts to enable it automatically on first run.
- **Any static bucket or "Sites" host**: upload the contents of `dist/` as-is. The site works from the domain root or from a sub-path.
- **Offline / local**: `npm run preview`, or serve `dist/` with any static file server.

## One demonstration link, two experiences

The entry screen offers **Office Staff** and **Clinician** demo access, each with a persona picker:

| Experience | Personas | Navigation |
| --- | --- | --- |
| Office Staff | Jordan Avery (Admin / Manager), Maya Chen (Intake), Sam Patel (Billing), Lena Ortiz (HR & Credentialing) | Scheduling (Requests, Schedule) · Patient · User · Region · Report · Chat · Credentials · Billing · Settings |
| Clinician | Priya Natarajan PT (default), Marcus Bell PTA, Elena Vasquez OT, Daniel Okafor PT, Hannah Lindqvist ST, Tomas Reyes COTA, Grace Kim PT, Omar Haddad PT (onboarding) | Home · Requests · Patients · Schedule · Chat · Credentials · Billing · My profile (bottom tab bar on phones) |

A discreet **Demo** control (bottom-right) switches experience or persona, lists the suggested walkthrough, returns to the entry screen and offers **Reset demo**. Role boundaries are simulated for the prototype, not production authentication. Clinicians never see office controls, other clinicians' records or agency bill rates; the office never types a rate on a clinician's behalf during billing.

## Demo walkthrough (about 10 minutes)

1. **Office (Maya) · Patient › Add patient & referral.** Enter the referral once; ZIP resolves the city, duplicates are flagged. "Save and create visit request".
2. **Scheduling › Requests › New request.** Discipline, visit type, visit-by, notes. *Select clinicians* lists eligible HHC clinicians by discipline and coverage with distance and credential status. Daniel Okafor is **blocked** (expired CPR) and cannot be selected; an Admin can record an override with a reason. Optional priority groups and wait times; first-come-first-served is the default. Review and send.
3. **Clinician (Priya) · Requests.** The request shows city/ZIP, agency, visit type, deadline and notes (no street address yet). Tap **Available**: the first eligible acceptance assigns her, the patient and chat open.
4. **Office · Scheduling › Requests.** The request is *Assigned*; responses show who accepted, read, or declined. **Scheduling › Schedule**: set the planned date and mark **Plotted in agency EMR** (a visit assigned for more than 24 h and not plotted shows as an exception). The clinician is notified and the message lands in the patient chat.
5. **Clinician · Schedule.** Open the visit, confirm **Visit completed** and **Note completed in agency EMR**, then **Submit for billing**: patient, agency, visit type and the agreed rate are pre-filled; add date and memo.
6. **Office (Sam) · Billing › Awaiting review.** The submission arrives with confirmation, plot status and both rates (clinician pay $120, agency bill $165 for a Bayside SOC). **Approve** snapshots both rates, or **Return with reason**. **Prepare agency billing**: pick agency and date range, create the invoice batch, **Export file for QuickBooks** downloads a sample QuickBooks Online CSV and marks the lines exported. **Clinician payment status**: mark paid with a reference.
7. **Clinician · Billing.** The same line shows *Approved* and *Paid* with the payment reference. Rates are shown, never editable; agency rates are not visible.
8. **Credentials.** As Daniel (clinician), Credentials shows the block and *Upload renewal*. As Lena (office), Credentials › Awaiting review shows the upload; approving it makes Daniel *Ready* again. The Renewal reminders tab lists 30/14/7/0-day milestones with "Send reminder now"; Requirements lets an Admin decide which credential types block new work.
9. **Also worth showing:** Patient search, User directory and profiles (with office-only rate card), Regions (ZIP or drawn coverage on a schematic map), Report › Visit Request Report (received / staffed / unstaffed by city or agency, time to staff, CSV export), Billing & Payout report, Chat channels (Intake, HR, Billing, Medical Records per clinician, read-only Announcements), Settings (agencies, access matrix, activity history).

## What is in scope (retained Phase 1) and how it maps

| Roadmap area | Where it lives in the prototype |
| --- | --- |
| Create Visit Request, Request Status and History, Visit Request List (5.x) | Scheduling › Requests: list with Pending / Assigned / Closed / Drafts, filters, CSV export; detail with request log, edit, cancel, close unstaffed, reopen |
| Select Clinicians, Send by Priority Group (6.1, 6.2) | New request wizard step 2: eligibility = discipline + coverage + accepting work + credential readiness; manual priority groups with wait; release next group manually |
| Request Responses, Assignment and Reassignment (7.x) | Responses board (Available / Read / Sent / Queued / Not available); FCFS auto-assign; office selection with recorded reason; reassign keeps chat history |
| Accept or Decline Request, My Requests and Visits (21.1, 18.1) | Clinician Requests and Home, desktop and mobile |
| Visit Schedule and EMR Plot Status, My Schedule, Confirm Visit and Note (8.1, 23.1, 25.1) | Office Schedule (planned date, plot status, exceptions); clinician Schedule with directions, two confirmations |
| Add Patient and Referral, Patient Details, Patient Search, My Patient Details (4.x, 22.1) | Patient menu; clinician sees only assigned patients and minimum necessary fields |
| User List and Clinician Profiles, User Access and Activity History, My Profile (11.1, 17.2, 19.1) | User menu with invite, deactivate, rate card, onboarding, activity; Settings › Access levels and Activity history; clinician profile with accepting-work toggle |
| Regions and Clinician Coverage (11.2) | Region menu: ZIP or polygon (simulated drawing) regions assigned to clinicians |
| Visit Request Report, Billing and Payout Reports (16.x) | Report menu with filters and CSV export |
| Patient Chat, Department Channels, My Chats (9.1, 10.1, 24.1) | Chat menu for both experiences; membership-based access |
| Clinician Onboarding, Credential Documents and Reminders, Credential Status, Review and Approval, Requirement Setup, Upload and Renew (12.x, 20.1) | Credentials menu (office) and Credentials (clinician) |
| Submit My Visit Billing, Visits Awaiting Billing Review, Review Visit Billing, Prepare Agency Billing, Export for QuickBooks, Update / My Payment Status (26.1, 13.x, 14.x, 15.1, 27.1) | Billing menu (office tabs) and clinician Billing |
| Reference Lists and Rates (17.1) | Settings (agencies, visit types, channels) and Billing › Rates |

**Deliberately not built** (deferred or later phases per the updated roadmap): combined work queue, weighted clinician ranking, agency credential viewer or any agency/patient login, central visit documentation, digital signature, geotagging, agency QA, EMR integration, AI documentation, SaaS features. Sign-in, MFA, password reset and terms acceptance are represented by the demo entry screen only.

## Material assumptions (recorded as requested)

- **Sources conflict resolution.** Where the roadmap and CareStitch screenshots differ, the roadmap wins: clinicians accept requests on desktop and mobile; the unused points-based scheduler and weekly availability calendar are not reproduced; the visit list replaces a drag-and-drop calendar.
- **Eligibility rule.** A clinician can receive new requests only when every credential marked "blocks new work" is approved and unexpired. Expiring within 30 days warns. A renewal under review does not unblock until approved. Overrides are Admin-only, reason and expiry required, and are shown on every request they are used for.
- **Assignment.** First-come-first-served is the default; the first *eligible* acceptance assigns. A blocked clinician's acceptance is recorded but held for office review. Office selection and assignment exceptions require a reason. One active assignment per request; reassignment closes the previous one and swaps chat membership.
- **Minimum necessary.** Before assignment a clinician sees city and ZIP, agency, visit type, deadline and notes; the patient name and street address appear only after assignment.
- **Billing evidence.** A submission needs both clinician confirmations (visit completed, note completed in agency EMR). Plotted-only visits are not billing-ready. Rates come from rate cards and are snapshotted on approval; an Admin may adjust the agency amount for one line with a reason. Duplicates (clinician + patient + date + visit type) are prevented.
- **QuickBooks export.** A QuickBooks Online invoice-import style CSV (InvoiceNo, Customer, InvoiceDate, DueDate, Terms, Item, Description, Qty, Rate, Amount, Memo, ServiceDate). The final mapping depends on the client's QuickBooks edition and is confirmed in the mapping workshop.
- **Payments** are recorded, never executed. Payout status is pending → approved → paid, with exception as a hold.
- **Geography** is a small fictional Bay Area ZIP set with approximate coordinates; distance and "city" are derived from it. Production uses a mapping provider with real ZIP boundaries and polygon drawing.
- **Notifications and emails** are simulated in-app (bell and channel messages). File uploads store only the file name.

## Known limitations of the prototype

- Single-browser demo data (localStorage). Two people on different machines do not share state; use one presenter screen and the Demo control to switch experiences. Two tabs in the same browser stay in sync.
- Delayed priority groups do not fire on a timer; the office releases the next group manually (the button is on the request).
- No real authentication, file storage, email, mapping service or QuickBooks connection.
- The office experience is designed for desktop; it remains usable but dense on phones. The clinician experience is responsive.

## Project layout

```
  src/domain/     types, rules (readiness, matching, billing), CSV export, geography, labels
  src/data/       seeded fictional scenario (agencies, clinicians, patients, requests, billing history)
  src/store/      shared state + all workflow actions, localStorage persistence, reset
  src/ui/         buttons, pills, cards, tabs, forms, modal/drawer, toasts, icons
  src/shared/     status pills, chat panel, notifications
  src/office/     office experience pages
  src/clinician/  clinician experience pages
  src/styles/     application stylesheet and brand tokens
```
