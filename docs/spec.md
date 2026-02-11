# Functional spec (MVP)

## Users & Auth
- Multi-user support.
- Auth: email + password.
- Long-lived login: short-lived access token + long-lived refresh token in HttpOnly cookie (rotation).

## Time events
- Event types: `COME`, `GO`, `BREAK_START`, `BREAK_END`.
- Each event is stored with current timestamp (UTC) and user.
- `COME` additionally stores:
  - `location`: `HOME` or `OFFICE` (required)
  - optional geolocation: latitude/longitude/accuracy (if user allowed).

## Default policies
- Daily target work time: **7.8h** (= 468 minutes).
- Break requirements (based on net work time per day):
  - `<= 6h`: **0 min**
  - `> 6h` and `<= 9h`: **30 min** (should be continuous; MVP checks total minutes, can be extended to continuous block check)
  - `> 9h`: **45 min** (30 + 15 extra)
- Monthly home-office target: **40% of worked days**.

## Dashboard
After login:
- 4 one-click actions: COME, GO, BREAK_START, BREAK_END.
- Shows today status:
  - worked so far (net)
  - remaining to target
  - break taken
  - required break for the day and remaining
  - current state (OFF/WORKING/BREAK)

## Reporting
- Weekly and monthly views:
  - total net worked time
  - break compliance
  - worktime violations (MVP: open sessions, missing transitions; can extend to max-hours rules)
  - number of home-office days and ratio

## Assumptions (confirm later)
- Day boundaries are computed in user timezone (default: Europe/Berlin). Stored timestamps are UTC.
- Break compliance in MVP is evaluated by total break minutes (not yet strict "continuous block" enforcement).
