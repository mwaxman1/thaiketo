# Route ALL ThaiKeto Email Capture DIRECTLY to Sequenzy (no daisy-chaining)

## Context

Mike's directive: **SWITCH TO SEQUENZY FOR ALL SITES. NO daisy-chaining form solutions.** Every email capture form must POST **directly** to the Sequenzy form endpoint — NOT through a `/api/subscribe` intermediary.

ThaiKeto's Sequenzy newsletter form (created 2026-09-09, published):
- **Form ID:** `o76kxb87r26dd3749df6ejqy`
- **Endpoint:** `https://api.sequenzy.com/api/v1/forms/o76kxb87r26dd3749df6ejqy`
- **Verified working:** POST with `Content-Type: application/x-www-form-urlencoded` + `Accept: application/json` → `{"success":true}`. **Multipart is REJECTED (HTTP 500)** — use urlencoded or JSON.

## Current state

ThaiKeto uses **native HTML form POST** (no JS handler) to `/api/subscribe`, which is a placeholder that returns success but does NOTHING (no real capture). The forms use `class="kc-email-capture"` with `action="/api/subscribe" method="POST"`.

Since native HTML form POST sends `application/x-www-form-urlencoded` (which Sequenzy accepts), the fix is simply to change each form's `action` to the Sequenzy endpoint. No JS needed.

## Files with `action="/api/subscribe"` forms

- `src/pages/index.astro` (line ~207)
- `src/pages/contact.astro` (line ~30)
- `src/pages/articles/[slug].astro` (line ~257)
- `src/pages/articles/thai-keto-food-list.astro` (line ~107)
- `src/pages/articles/keto-pad-thai-recipe.astro` (line ~86)
- `src/pages/articles/thai-keto-ingredients-guide.astro` (line ~86)
- `src/pages/articles/keto-thai-green-curry.astro` (line ~89)
- `src/pages/articles/thai-keto-meal-plan.astro` (line ~82)
- `src/pages/articles/keto-tom-yum-soup.astro` (line ~78)

## Changes

### 1. Delete `src/pages/api/subscribe.ts`
No daisy-chaining. Remove the placeholder endpoint.

### 2. Change every form's `action` from `/api/subscribe` to the Sequenzy endpoint

In each of the 9 files, change:
```
action="/api/subscribe"
```
to:
```
action="https://api.sequenzy.com/api/v1/forms/o76kxb87r26dd3749df6ejqy"
```

The native HTML form POST (urlencoded) will now hit Sequenzy directly. The `kc-email-note` element will show whatever the page's existing handling does — if there's no JS handler, the form will do a full page navigation on submit (native behavior). That's acceptable — the email is captured. If a page has a JS handler that reads `kc-email-note`, keep it.

## Verification

1. `grep -rn "api/subscribe" src/` → ZERO (endpoint deleted, no references).
2. `grep -rn "o76kxb87r26dd3749df6ejqy" src/` → present in all 9 files.
3. `npm run build` → succeeds.
4. After deploy: `curl -sS -X POST https://api.sequenzy.com/api/v1/forms/o76kxb87r26dd3749df6ejqy -H "Content-Type: application/x-www-form-urlencoded" -H "Accept: application/json" -d "email=verify-<ts>@example.com"` → `{"success":true}`.

## Constraints

- Do NOT create any intermediary endpoint — forms POST directly to Sequenzy.
- Do NOT add new files, CSS files, or components.
- Do NOT modify any content file other than the 9 listed.
- Use RELATIVE paths in all edits.
