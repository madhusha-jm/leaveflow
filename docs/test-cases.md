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

## Test cases

| ID | Story | Steps | Expected | Actual | Pass? | Notes |
|----|-------|-------|----------|--------|-------|-------|
| TC-01 | US-1 | Log in as `ishara@ceylonroots.lk` with password `wrong` | Stays on the login screen, red message "wrong email or password" | | | |
| TC-02 | US-1, US-3 | Log in as Ishara with `password123` | Top bar shows "Ishara Fernando · Employee". Cards: Annual **14**, Casual **7**, Sick **7** | | | |
| TC-03 | US-2, US-10 | Apply: Annual, Start **Mon 19 Oct 2026**, End **Wed 21 Oct 2026**, reason "Family trip" → Apply | Green "Request #1 sent for 3 day(s)". Request listed as **PENDING**. Annual card **11**, "available of 14 · **3 pending**" | | | |
| TC-04 | US-2 | Apply: Sick, **Tue 27 Oct** → **Thu 5 Nov 2026** (8 working days) | Red "only 7 Sick day(s) available; this request needs 8". No new request in the list; Sick still **7** | | | |
| TC-05 | US-2 | Apply: Annual, **Tue 20 Oct** → **Fri 23 Oct** | Red "overlaps your PENDING request #1 …". No new request | | | |
| TC-06 | US-2 | Pick Start **Fri 23 Oct**, then End **Mon 19 Oct** (type it if the picker blocks it) | **Apply** stays greyed out; red "End date must be on or after the start date" | | | |
| TC-07 | US-2 | Apply: Annual, **Mon 23 Nov** → **Wed 25 Nov** | "sent for **2** day(s)" — Tue 24 Nov (Il Poya) is not counted. Then **Cancel** it (clean-up for later cases) | | | |
| TC-08 | NFR-2 | Still as Ishara: look at the top bar | No **Approvals** tab (employees can't approve) | | | |
| TC-09 | US-4, NFR-2 | Log out. Log in as `kasun@ceylonroots.lk` (another team's manager) → Approvals | "Nothing waiting for you." — Ishara's request is **not** shown | | | |
| TC-10 | US-4 | Log out. Log in as `ruwan@ceylonroots.lk` → Approvals | Ishara's request: Annual · 3 day(s) · 19 → 21 Oct, "Family trip", hint "Annual: 11 of 14 left after this · 3 pending in total" | | | |
| TC-11 | US-4, NFR-3 | Ruwan clicks **Approve** | Item disappears; "Nothing waiting for you." | | | |
| TC-12 | US-3, US-10 | Log out. Log in as Ishara | Request #1 **APPROVED**. Annual **11**, no "pending" text. No Cancel button on it | | | |
| TC-13 | NFR-3 | Thunder Client: log in as Ishara (`POST /api/auth/login`), then `GET /api/leave-requests` with her token | Request 1 has `"decided_by": 1` (Ruwan) and a `decided_at` timestamp | | | |
| TC-14 | US-4 | Thunder Client: log in as Ruwan, `PATCH /api/leave-requests/1` body `{"action":"approve"}` | **409** `INVALID_STATE` "cannot approve a request that is already APPROVED" | | | |
| TC-15 | US-5 | Thunder Client, Ishara's token: `PATCH /api/leave-requests/1` body `{"action":"cancel"}` | **409** — approved requests can't be cancelled | | | |
| TC-16 | US-5 | In the app as Ishara: Casual, **Mon 9 Nov** → **Mon 9 Nov** → Apply → **Cancel request** → OK | Status **CANCELLED**; Casual card back to **7**, no pending | | | |
| TC-17 | US-4 | Ishara applies Annual **Mon 16 Nov** → **Tue 17 Nov**. Ruwan **Rejects** it. Ishara logs back in | Status **REJECTED**; Annual back to **11** (the 2 reserved days are released) | | | |
| TC-18 | US-9 | Log in as `dilini@ceylonroots.lk` (HR) → Approvals | Tab says "all teams". Nimali can apply (as Nimali) and Dilini sees it here and can approve it | | | |
| TC-19 | NFR-4 | As Ishara: F12 → **Ctrl+Shift+M** → set width **360** | Everything readable; buttons tappable; **no sideways scrolling** | | | |
| TC-20 | — | Stop the server (Ctrl+C in the `npm server` terminal), then try to log in | Red "Cannot reach the server — is it running?" (no blank page, no crash). Restart the server afterwards | | | |

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

| Time | What I tried | What happened | Bug? |
|------|--------------|---------------|------|
| | | | |
