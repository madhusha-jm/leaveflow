# LeaveFlow — manual test cases

Automation checks what we predicted; these cases are for a human to run in the browser,
so we also notice what we didn't predict (wrong wording, confusing screens, slow pages).
Each case comes from an acceptance criterion or NFR in [requirements.md](requirements.md).

**How to run:** fill in **Actual** and **Pass?** as you go. A FAIL becomes a GitHub issue
using the **Bug report** template (Issues → New issue → Bug report), and the issue number
goes in the Notes column.

## Before you start

1. Docker `leaveflow-pg` running, `npm run dev` in `server/` and in `client/`.
2. Start from empty requests (dev data only — this deletes all leave requests):
   ```
   docker exec leaveflow-pg psql -U postgres -d leaveflow -c "TRUNCATE leave_requests, leave_balances RESTART IDENTITY;"
   ```
3. Open http://localhost:5173. Every account's password is `password123`.
4. Run the cases **in order** — later cases build on earlier ones (request #1 is TC-03's).

Dates are in late 2026 because the form refuses past dates. If you run this after those
dates, move every date forward by the same number of weeks (keep the weekdays the same).
Known holidays in this range: **Mon 26 Oct** (Vap Poya), **Tue 24 Nov** (Il Poya).

Run on: ____________ (date) · Tester: ____________ · Browser: ____________ · Commit: `git log -1 --oneline` → ____________

### Run 1 — result: 20 / 20 PASS, 5 bugs from the exploratory session

Run on: **28 Sep 2026** · Tester: **Claude (for Madhusha)** · Browser: **Microsoft Edge 154**, driven by a Playwright
script, with screenshots reviewed by eye · Commit: `1a9cfac` · Where: the isolated test stack (API :4001 on
`leaveflow_test`, client :5174) instead of dev, so the reset step didn't wipe dev data. Same code, same steps.

## Test cases

| ID | Story | Steps | Expected | Actual | Pass? | Notes |
|----|-------|-------|----------|--------|-------|-------|
| TC-01 | US-1 | Log in as `ishara@ceylonroots.lk` with password `wrong` | Stays on the login screen, red message "wrong email or password" | Red "wrong email or password"; still on login | **PASS** |  |
| TC-02 | US-1, US-3 | Log in as Ishara with `password123` | Top bar shows "Ishara Fernando · Employee". Cards: Annual **14**, Casual **7**, Sick **7** | "Ishara Fernando · Employee"; Annual 14, Casual 7, Sick 7 | **PASS** |  |
| TC-03 | US-2, US-10 | Apply: Annual, Start **Mon 19 Oct 2026**, End **Wed 21 Oct 2026**, reason "Family trip" → Apply | Green "Request #1 sent for 3 day(s)". Request listed as **PENDING**. Annual card **11**, "available of 14 · **3 pending**" | "Request #1 sent for 3 day(s) — waiting for approval."; PENDING; Annual 11 · 3 pending | **PASS** |  |
| TC-04 | US-2 | Apply: Sick, **Tue 27 Oct** → **Thu 5 Nov 2026** (8 working days) | Red "only 7 Sick day(s) available; this request needs 8". No new request in the list; Sick still **7** | "only 7 Sick day(s) available; this request needs 8"; list unchanged; Sick 7 | **PASS** |  |
| TC-05 | US-2 | Apply: Annual, **Tue 20 Oct** → **Fri 23 Oct** | Red "overlaps your PENDING request #1 …". No new request | "overlaps your PENDING request #1 (2026-10-19 to 2026-10-21)" | **PASS** |  |
| TC-06 | US-2 | Pick Start **Fri 23 Oct**, then End **Mon 19 Oct** (type it if the picker blocks it) | **Apply** stays greyed out; red "End date must be on or after the start date" | Apply disabled; "End date must be on or after the start date." | **PASS** |  |
| TC-07 | US-2 | Apply: Annual, **Mon 23 Nov** → **Wed 25 Nov** | "sent for **2** day(s)" — Tue 24 Nov (Il Poya) is not counted. Then **Cancel** it (clean-up for later cases) | "Request #2 sent for 2 day(s)"; cancelled → CANCELLED; Annual back to 11 · 3 pending | **PASS** |  |
| TC-08 | NFR-2 | Still as Ishara: look at the top bar | No **Approvals** tab (employees can't approve) | No Approvals tab | **PASS** | See BUG-05 |
| TC-09 | US-4, NFR-2 | Log out. Log in as `kasun@ceylonroots.lk` (another team's manager) → Approvals | "Nothing waiting for you." — Ishara's request is **not** shown | "Waiting for your decision · your team" — "Nothing waiting for you." | **PASS** |  |
| TC-10 | US-4 | Log out. Log in as `ruwan@ceylonroots.lk` → Approvals | Ishara's request: Annual · 3 day(s) · 19 → 21 Oct, "Family trip", hint "Annual: 11 of 14 left after this · 3 pending in total" | 1 item: Ishara · Annual · 3 day(s), 19→21 Oct, "Family trip", "Annual: 11 of 14 left after this · 3 pending in total" | **PASS** |  |
| TC-11 | US-4, NFR-3 | Ruwan clicks **Approve** | Item disappears; "Nothing waiting for you." | "Nothing waiting for you." | **PASS** |  |
| TC-12 | US-3, US-10 | Log out. Log in as Ishara | Request #1 **APPROVED**. Annual **11**, no "pending" text. No Cancel button on it | #1 APPROVED, no Cancel button; Annual 11, no pending | **PASS** |  |
| TC-13 | NFR-3 | Thunder Client: log in as Ishara (`POST /api/auth/login`), then `GET /api/leave-requests` with her token | Request 1 has `"decided_by": 1` (Ruwan) and a `decided_at` timestamp | status APPROVED, decided_by 1, decided_at 2026-09-28T17:12:12Z | **PASS** |  |
| TC-14 | US-4 | Thunder Client: log in as Ruwan, `PATCH /api/leave-requests/1` body `{"action":"approve"}` | **409** `INVALID_STATE` "cannot approve a request that is already APPROVED" | 409 INVALID_STATE "cannot approve a request that is already APPROVED" | **PASS** |  |
| TC-15 | US-5 | Thunder Client, Ishara's token: `PATCH /api/leave-requests/1` body `{"action":"cancel"}` | **409** — approved requests can't be cancelled | 409 INVALID_STATE "cannot cancel a request that is already APPROVED" | **PASS** |  |
| TC-16 | US-5 | In the app as Ishara: Casual, **Mon 9 Nov** → **Mon 9 Nov** → Apply → **Cancel request** → OK | Status **CANCELLED**; Casual card back to **7**, no pending | #3 sent (Casual 6 · 1 pending) → CANCELLED; Casual back to 7 | **PASS** |  |
| TC-17 | US-4 | Ishara applies Annual **Mon 16 Nov** → **Tue 17 Nov**. Ruwan **Rejects** it. Ishara logs back in | Status **REJECTED**; Annual back to **11** (the 2 reserved days are released) | #4 REJECTED; Annual back to 11 | **PASS** |  |
| TC-18 | US-9 | Log in as `dilini@ceylonroots.lk` (HR) → Approvals | Tab says "all teams". Nimali can apply (as Nimali) and Dilini sees it here and can approve it | Heading "· all teams"; Nimali's #5 shown with "Annual: 12 of 14 left…"; approved → inbox empty | **PASS** |  |
| TC-19 | NFR-4 | As Ishara: F12 → **Ctrl+Shift+M** → set width **360** | Everything readable; buttons tappable; **no sideways scrolling** | Page width 360 = viewport (no sideways scroll); Apply button 294×44 px | **PASS** | BUG-05 (cosmetic) |
| TC-20 | — | Stop the server (Ctrl+C in the `npm server` terminal), then try to log in | Red "Cannot reach the server — is it running?" (no blank page, no crash). Restart the server afterwards | Red "Cannot reach the server — is it running?"; stayed on login | **PASS** |  |

### Capstone — half days and the holiday calendar (US-15 – US-18)

Run after TC-20, on the same data (Ishara still has request #1 approved). Fill in **Actual** and **Pass?** as you go.

**Run 2 — result: 11 / 11 PASS.** 6 Oct 2026 · Microsoft Edge driven by a Playwright script · commit `bd84bd1` ·
on the isolated test stack (fresh data, so Ishara starts at Annual 14, not 11 — the expected *changes* are the same).
The same journeys are automated in `server/tests/halfDays.test.js`, `server/tests/holidays.test.js`,
`client/src/components/ApplyLeaveForm.test.jsx` and `e2e/approve-flow.spec.js`.

| ID | Story | Steps | Expected | Actual | Pass? | Notes |
|----|-------|-------|----------|--------|-------|-------|
| TC-21 | US-15, US-16 | As Ishara: Annual, **Length → Morning only (½ day)**, Date **Mon 30 Nov 2026**, reason "Bank" → Apply | The End date box disappears when Morning is chosen. Preview "0.5 working day(s)". Green "sent for 0.5 day(s)". Listed as "Mon 30 Nov 2026 · morning", **PENDING**. Annual card drops by **0.5**, "0.5 pending" | End date box hidden; preview "0.5 working day(s) · 14 Annual day(s) available"; "Request #1 sent for 0.5 day(s)"; listed "Mon 30 Nov 2026 · morning", PENDING; Annual 14 → **13.5** · 0.5 pending | **PASS** |  |
| TC-22 | US-15 (D12) | Same date, **Afternoon only** → Apply. Then the same date, **Morning only** again → Apply | Afternoon: accepted (morning + afternoon don't clash). Morning again: red "overlaps your PENDING request … morning)" | Afternoon: "Request #2 sent for 0.5 day(s)"; morning again: "overlaps your PENDING request #1 (2026-11-30 to 2026-11-30, morning)" | **PASS** |  |
| TC-23 | US-18 | Morning only on **Thu 24 Dec 2026** (Unduvap Poya) | Red "That's only weekends or public holidays — no leave needed."; **Apply** greyed out | "That's only weekends or public holidays — no leave needed."; Apply disabled | **PASS** |  |
| TC-24 | US-16, US-4 | Log in as Ruwan → Approvals | Ishara's two half days show "Mon 30 Nov 2026 · morning" / "· afternoon", **0.5 day(s)** each. Approve the morning; Ishara's Annual card still shows the same available number, pending drops to 0.5 | Two items "0.5 day(s) · Mon 30 Nov 2026 · morning" / "· afternoon"; approved the morning → 1 left; Ishara: Annual 13 available · 0.5 pending | **PASS** |  |
| TC-25 | US-18 | As Ishara: Annual, Full day(s), **Mon 21 Dec → Fri 25 Dec 2026** (don't apply) | Preview "3 working day(s)" and "Not charged: Unduvap Full Moon Poya (Thu 24 Dec 2026); Christmas Day (Fri 25 Dec 2026)" | "3 working day(s)"; "Not charged: Unduvap Full Moon Poya (Thu 24 Dec 2026); Christmas Day (Fri 25 Dec 2026)" | **PASS** |  |
| TC-26 | US-17, NFR-2 | Look at the top bar as Ishara, then as Ruwan | No **Holidays** tab for either | No Holidays tab for Ishara or Ruwan | **PASS** |  |
| TC-27 | US-17 | Log in as Dilini (HR) → **Holidays** | 16 holidays listed for 2026. Click **›** → 2027: red "No holidays for 2027 yet — nobody can book leave in 2027…" | 2026: 16 holidays; 2027: "No holidays for 2027 yet — nobody can book leave in 2027 until they are added." | **PASS** |  |
| TC-28 | US-17 | Still as Dilini: Date **21 Jan 2027**, Name "Duruthu Full Moon Poya" → **Add holiday** | Green "Added Duruthu Full Moon Poya on Thu 21 Jan 2027"; the page shows 2027 with it listed | "Added Duruthu Full Moon Poya on Thu 21 Jan 2027."; listed under 2027 | **PASS** |  |
| TC-29 | US-17 | Add the same date again with any name | Red "2027-01-21 is already a holiday"; list unchanged | "2027-01-21 is already a holiday"; still 1 item | **PASS** |  |
| TC-30 | US-17, US-18 | As Ishara: Annual, **Wed 20 Jan → Fri 22 Jan 2027** → Apply. Then cancel it | Preview names Duruthu as not charged; green "sent for **2** day(s)" (before TC-28 this was refused: "public holidays for 2027 are not loaded yet") | "Not charged: Duruthu Full Moon Poya (Thu 21 Jan 2027)"; "Request #3 sent for 2 day(s)"; cancelled → CANCELLED | **PASS** |  |
| TC-31 | US-17 | As Dilini: **Remove** Duruthu → OK | Gone from the 2027 list; the red "No holidays for 2027 yet" message is back | Duruthu gone; "No holidays for 2027 yet…" shown again | **PASS** |  |

## Not built yet — expected to fail, not bugs

These requirements are deferred (see the table in [design.md](design.md)); don't file bugs
for them, but do note if the app behaves *dangerously* around them.

| Requirement | Today's behaviour |
|---|---|
| Rule-1 / Rule-2: medical certificate for sick leave over 3 days | No certificate upload; 4-day sick requests can be approved |
| Rule-3: no annual leave over New Year shutdown week | Only the 13–14 April public holidays are skipped; the rest of the week can be booked |
| US-6, US-7, US-8, US-11–13 | Not in v1 |

## Exploratory session

Scripted cases check what we expected. Now spend **30 minutes** trying to break it.

**Charter:** *Try to break leave balances using cancellations, rejections and re-applications.*

Ideas to start from — then follow your curiosity:
- Apply, cancel, apply the same dates again — does the balance end up right?
- Two browser windows as Ishara (one normal, one InPrivate): cancel in one, then cancel again in the other
- Ruwan and Dilini both open the inbox; both approve the same request
- Apply for exactly the whole remaining balance; then try one more day
- Very long reason text; emoji; a reason with `<script>alert(1)</script>`
- Request crossing New Year (e.g. Mon 28 Dec 2026 → Fri 8 Jan 2027) — which year's balance moves?

### Run 1 log (28 Sep 2026)

| # | What I tried | What happened | Bug? |
|---|--------------|---------------|------|
| E1 | Apply, cancel, apply the same dates again | Re-apply accepted (201); balance correct: 12 available, 2 pending | No |
| E2 | Cancel the same request from two tabs at once | 200 then 409; Casual back to 7 | No |
| E3 | HR approves the same request twice at the same instant | 200 then 409; approved days counted once (2) | No |
| E4 | Apply exactly the remaining Sick balance (7), then 1 more day | 201 (7 days), then 409 INSUFFICIENT_BALANCE; available 0 | No |
| E5 | Reason `<script>alert(1)</script> 🎉`; 500 / 501 chars; only spaces | Stored as typed and **shown as plain text — no script ran**; 500 OK, 501 → 400; only spaces → stored as empty | No |
| E6a | Casual Mon 28 Dec 2026 → Fri 8 Jan 2027 (10 days: 4 in 2026, 6 in 2027) | Refused "only 7 Casual day(s) available; this request needs 10" — **all 10 days are charged to 2026** | **BUG-03** |
| E6b | Annual Thu 14 – Fri 15 Jan 2027 (Thai Pongal falls in mid-January every year) | Counted **2 days** — there is no 2027 holiday list at all | **BUG-04** |
| E7 | Two *different* Sick requests (4 + 4 days) sent at the same instant; balance 7 | **Both accepted → Sick available = −1** | **BUG-01** |
| E8 | The *same* request sent twice at the same instant (two tabs) | **Two identical PENDING requests** (#17 and #18) | **BUG-02** |
| E9 | Sick leave for last week, via the API | Accepted (201). The web form can't do this (it refuses past dates) — but sick leave is usually applied for *after* being sick | Question for Nadeesha (below) |

### Bugs found

| ID | Title | Severity | Priority |
|----|-------|----------|----------|
| BUG-01 | Two requests sent at the same moment can overspend the balance (went to −1) | S1 | P1 |
| BUG-02 | The same request sent twice at the same moment creates duplicates | S2 | P2 |
| BUG-03 | A request crossing New Year is charged entirely to the first year | S3 | P2 |
| BUG-04 | No 2027 holiday list — every 2027 holiday will be counted as a leave day | S2 | P1 (before 1 Jan 2027) |
| BUG-05 | On a phone, employees see a full-width "My leave" tab with nothing else in the bar | S4 | P3 |

BUG-01 and BUG-02 share one cause: the checks (overlap, balance) and the insert are separate
steps, so two requests arriving together both pass the checks before either is saved.

### Question for Nadeesha (not a bug — a requirement gap)

The web form refuses past dates, so an employee who was sick yesterday **can't apply for that
sick day** in the app. Should sick leave (at least) be allowed with past dates? If yes, how far back?
