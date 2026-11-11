# Verdant — Smart Plant Monitoring & Automation Platform

## Project Progress Document

This document tracks completed milestones, architecture decisions, important files, required environment variables, outstanding issues, and next actions.

---

## Completed Milestones

### Milestone 1 — Foundation and Authentication (COMPLETE)

**What was built:**
- Vite + React + TypeScript + Tailwind CSS foundation.
- Supabase client singleton.
- Email/password sign-up, sign-in and sign-out.
- Auth context with session state.
- Responsive app layout with sidebar and mobile drawer.
- Seven section pages: Overview, Sensor History, Pump Control, Automation, Schedules, Alerts, Settings.
- Nature-inspired design system.

### Milestone 2 — Database, Owner Access and Device Backend (AUDITED, AWAITING APPROVAL)

**Starting state found in the import (verified):**
- No `supabase/` folder existed in the imported source. The three migration files named in the brief were not present.
- The Supabase database was empty: no tables, no migrations recorded, no accounts, no Edge Function secrets.
- Milestone 2 was therefore built from the schema design in the brief rather than by reviewing existing SQL.

**Migrations applied (in order):**
1. `profiles_owner_access`: profiles table, owner check, and the sign-up trigger. The first account becomes the owner; every later account is pending until the owner approves it.
2. `devices_and_credentials`: devices and device credentials. Only a SHA-256 hash of each device secret is stored. Register, rotate and revoke functions.
3. `readings_states_commands`: telemetry history, latest device state (only moves forward on newer sequence numbers), command lifecycle with separate receipt and execution acknowledgements.
4. `owner_check_runs_as_caller`: owner check changed to run with the caller's own permissions.

**Security measures (as designed):**
- Row level security on every table. Browsers can only read their own profile and, if owner, their own devices, readings, states and commands.
- No browser role has a write policy on device or command tables. Writes happen only in server functions.
- Device credential hashes are unreadable from the browser.
- Pending and non-owner accounts are blocked in the app and by the database.

**Audit findings (verification-only pass, no code or schema changed):**

Verified by live query:
- Four migrations recorded as applied. Tables: profiles, devices, device_credentials, readings, device_states, commands.
- Owner row exists: one profile, `is_owner = true`, `is_pending = false`, owning 2 devices.
- Two devices ("Plant", "plant 2") each have one active credential. Stored hashes are 64-character lowercase hex (SHA-256). No plaintext secret is in the database.
- A signed-in non-owner user sees zero devices, credentials, profiles, commands, readings and states.
- An anonymous visitor sees zero devices, credentials and profiles.
- The owner, simulated as an authenticated user, sees their 2 devices and passes the owner check.
- All four Edge Functions are ACTIVE with the intended public or signed-in access settings.
- The three original migration files named in the brief were never present in the import. The four migrations above were written from the brief's design.

Code inspection only (not yet exercised end to end):
- Device registration returns a one-time secret; device authentication compares its hash; telemetry rejects bad fields and duplicate sequences; command creation checks owner and device ownership; acknowledgements check the authenticated device. Nothing has been called with a real secret yet.
- Device with a real secret: not tested. The two existing devices' secrets were not available to this audit.
- Unauthorized command creation: not tested. Code rejects non-owners, and no browser write policy exists on the commands table.

Open security issues:
1. **Over-broad table grants (medium).** The `anon` and `authenticated` roles hold INSERT, UPDATE and DELETE on every public table, not just SELECT. Row level security blocks these writes today because no write policies exist, but one future policy mistake could open them. Fix: revoke all write grants from browser roles and keep SELECT only (needs approval).
2. **Performance warnings (low).** Four policies call `auth.uid()` per row; wrap as `(select auth.uid())`. One unindexed foreign key on `commands.requested_by`. Two indexes are unused until history queries run.
3. **Credential table (informational).** RLS is on with no client policy, which is intended.

**Edge Functions deployed (all ACTIVE):**
- `device-telemetry` (device authentication, validated reading, history update, returns pending commands). Device-facing, no user login.
- `device-command-ack` (device receipt and execution acknowledgements, checked against the device that owns the command).
- `owner-devices` (owner registers, regenerates secret, revokes devices). Requires owner login.
- `owner-commands` (owner creates pump on, pump off, or calibration sync commands with expiry). Requires owner login.

**Frontend changes:**
- Owner gate: only the owner sees the dashboard. Pending and non-owner accounts see a clear notice with sign out; errors offer retry.
- Settings page: device registration, one-time secret display with copy, new secret, revoke.

**Verification:**
- Typecheck: PASS.
- Build: PASS.
- Lint: PASS (0 errors; one pre-existing warning about exports in the auth context file).
- Security advisor: no blocking findings. Over-broad browser grants and performance warnings are listed under the audit findings.
- Not yet verified: end-to-end test with a real owner account and a real device (requires owner sign-up and hardware).

### Milestone 3 — Telemetry Dashboard (BUILT, UNTESTED WITH HARDWARE)

**What was built (frontend):**
- Overview page: live device status (online/offline from last reading time), latest moisture, raw reading, pump state, and the most recent commands. Updates through Realtime on the device state and command tables; a 15-second clock keeps "last seen" text fresh.
- Sensor History page: moisture chart over selectable ranges with a visible note when the history is truncated. Live new readings are appended through Realtime.
- Device selector appears only when the owner has two or more devices.
- Shared status badge and relative-time helpers used by both the device manager and dashboards.
- Empty, loading and error states on every panel, with retry where data can fail.

**Database change:**
- Migration `add_commands_to_realtime`: adds the commands table to the Realtime publication so command status changes reach the dashboard. No grants or policies changed.

**Verification:**
- Typecheck: PASS.
- Production build: PASS.
- Lint: 0 errors; one pre-existing warning in the auth context file.
- Security and performance advisors: informational only (device credentials table has RLS with no client policy, intentionally; unused indexes are expected on an empty database).
- Not verified: live display with real readings. The database currently has no owner account, device or readings, so the dashboards can only show empty states until hardware is connected.

**Not built yet:** ESP8266/Arduino firmware (no firmware exists in the project), pump control buttons, automation rules, schedules, alerts, and settings extensions (calibration, retention, pump safety).

---

## Architecture Decisions

| Decision | Choice | Reason |
|---|---|---|
| Frontend stack | Vite + React + TypeScript + Tailwind | Provided template, zero cost |
| Backend / database / auth | Supabase (managed) | Zero cost, integrated auth + DB + Edge Functions |
| Owner model | First sign-up is owner; later sign-ups pending until approved | Single-owner dashboard, no public access |
| Device secrets | Random 32-byte secret, only SHA-256 hash stored | Plaintext shown once, never recoverable from database |
| Device telemetry | One request every 8 seconds returns both data upload and pending commands | Halves Edge Function usage versus separate polling |
| Command lifecycle | pending, received, executed, failed, expired; receipt and execution are separate | Delivery is never treated as proof the pump operated |
| Routing | Hash-based state routing | Simple, sufficient for single-owner dashboard |
| Design palette | Nature greens + clay + sky (no purple) | Nature-inspired, professional |

---

## Device API (for firmware, Milestone 3)

Base address: the project's Edge Functions address (`/functions/v1/...`).

- Every device request sends `X-Device-Id: <device id>` and `Authorization: Bearer <device secret>`.
- `POST /device-telemetry` with `{ sequence, raw_reading (0-1024), moisture_percent (0-100), pump_on }`. Response includes `outcome` (accepted, duplicate, stored_out_of_order) and `commands` to act on.
- `POST /device-command-ack` with `{ command_id, stage: "receipt" }` then `{ command_id, stage: "execution", outcome: "executed" | "failed", failure_reason }`.

---

## Free-Tier Considerations

- Edge Function calls: at an 8-second interval, one device uses roughly 324,000 calls per month. Two devices would exceed the commonly listed free allowance of 500,000 per month. Confirm current limits on the Supabase pricing page before adding a second device; a longer interval (for example 30 seconds) would be needed.
- Database growth: each device stores one history row every 8 seconds. Retention cleanup should be planned before long-term use.

---

## Environment Variables

Frontend (already configured):
| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Supabase project URL (browser-safe) |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public key (browser-safe) |

Server-only (provided automatically to Edge Functions, never in browser or firmware): `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Outstanding Issues

- **Sequence reset risk:** if the device restarts and its sequence counter resets to zero, new readings will be stored as out-of-order and will not update the latest state. The firmware must persist its counter or Milestone 3 must add a boot identifier.
- **Raw range:** the brief's air calibration value is 1024, but analog readings on the Arduino are 0 to 1023. Ranges accept 0 to 1024 to match the brief; confirm during firmware review.
- **Owner bootstrap:** the first account to sign up becomes the owner. Sign up the owner account before sharing the app address.
- **Account approval:** there is no approval screen yet. Pending accounts are approved by setting `profiles.is_pending` to false in the database table editor.
- **Pump and calibration controls:** the owner command endpoint exists but no pump buttons are on the Pump page yet (Milestone 3+).
- **Device end-to-end test:** not yet done; requires the owner account and the ESP8266 firmware work in Milestone 3.
- **Untested behaviour:** device authentication, telemetry, command creation, acknowledgements and rejection of unauthorized commands have not been exercised with real requests.
- **Free-tier check:** the call-count estimate above still needs confirmation against current Supabase pricing before a second device is used heavily.
- **Edge Function secrets:** the secrets list was not re-checked in this audit.

---

## Next Actions

Status of earlier audit decisions:
1. Browser-role write grants were trimmed to SELECT only, and the policies were rewritten to use the caller-wrapped auth check (applied in the hardening migration).
2. The performance fixes (auth call wrapping, index on commands.requested_by) were applied.
3. End-to-end tests with a real owner account and device have not been run.

Manual steps for the owner:
1. Sign up with your email and password first. Your account becomes the owner. The live database currently has no accounts, so this must be repeated.
2. Open Settings, register your device, and copy its secret into the ESP8266 once shown.
3. Keep the secret private; if lost, generate a new one from Settings.
4. Follow SETUP.md for the wiring and firmware steps.

Remaining work, in order:
1. Firmware for the ESP8266 (telemetry every 8 seconds, command acknowledgements, sequence counter saved across restarts).
2. Pump control buttons on the Pump page, using the owner command endpoint.
3. Automation rules, schedules, alerts and settings extensions.
4. End-to-end testing with hardware.
