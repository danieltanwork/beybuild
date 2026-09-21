# BeyBuild

A mobile-first PWA for tracking your Beyblade X collection and building combos from the parts you actually own.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS)
- **Neon** (Postgres) via `@neondatabase/serverless` + Drizzle ORM
- **Neon Auth** (Stack Auth) for login — Google/GitHub sign-in work out of the box with no extra setup
- **Vercel Blob** for storing box/part photos
- A hand-rolled service worker + manifest for installability (Add to Home Screen)

## What's here

- `/` — dashboard (parts owned, builds saved, quick actions)
- `/inventory` — your boxes, grouped, with each part's photo
- `/inventory/add` — log a new box: photo the box + each part, name each part (autocompletes against parts you've already logged)
- `/build` — visual picker: tap a Blade, Ratchet, and Bit from your own inventory to assemble and save a combo
- `/handler/*` — auto-generated Stack Auth sign-in/sign-up/account pages

Data model (`src/db/schema.ts`):
- `parts` — the global catalog (one row per distinct Blade/Ratchet/Bit, shared across all users). Each part has one canonical `image_url`, set automatically the first time any user photographs that part ("first photo wins").
- `inventory` — what a specific user owns. Three rows per box (one per part), grouped by a shared `box_id`.
- `builds` — saved Blade + Ratchet + Bit combos per user.

## What's deliberately NOT built yet

- **OCR / barcode auto-fill.** Adding a box currently asks you to type the part names (with autocomplete) rather than reading them automatically from a photo. This was left out rather than half-wired: an unreliable auto-fill is worse than a fast manual flow. The photo capture UI is already in place, so this can be layered on top later (Tesseract.js for the product code, or a barcode scan) without changing the data model.
- **Full parts catalog.** Only one verified example part (Phoenix Wing / 9-60 / GF) is seeded — I didn't want to fabricate stat numbers I couldn't verify. The catalog grows organically as you log your own boxes, or you can bulk-import a community parts list later.
- **Stat numbers on parts.** The schema has `attack`/`defense`/`stamina`/`weight_g` columns ready to use, but they're left null until sourced from somewhere verifiable.

## Local setup

1. Copy `.env.example` to `.env.local` (already done in this environment — see below for what's still missing).
2. Get your **Stack secret server key**: Neon console → your project → **Auth** tab → Configuration, or the Stack Auth dashboard. Put it in `STACK_SECRET_SERVER_KEY`. This can't be fetched via API — it's a genuine secret, deliberately not returned by any listing endpoint.
3. Create a **Vercel Blob store**: Vercel dashboard → your project → Storage → Create Database → Blob. Copy the `BLOB_READ_WRITE_TOKEN` into `.env.local` (and add it as a Vercel project env var for production/preview). I tried to provision this automatically but the connected Vercel API token doesn't have Blob-creation permission — this is the one manual step left.
4. `npm install`
5. `npm run dev`

## Already provisioned for you

- Neon project **`beybuild`** (`gentle-lab-03321101`), schema applied (`parts`, `inventory`, `builds`).
- Neon Auth enabled (Stack provider) — Google and GitHub sign-in are enabled by default with shared credentials, no OAuth app setup needed.
- Vercel project **`beybuild`** already has `DATABASE_URL`, `NEXT_PUBLIC_STACK_PROJECT_ID`, and `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY` set for all environments. Still needs `STACK_SECRET_SERVER_KEY` and `BLOB_READ_WRITE_TOKEN` added the same way (step 2–3 above) before it will build on Vercel.

## Suggested next steps

1. Add the two missing env vars (locally and on Vercel) and confirm `npm run build` / a real deploy both work end to end.
2. Try the golden path in a browser on your phone: sign in → add a box with real photos → build a combo.
3. Layer in OCR (Tesseract.js, client-side) or barcode scanning to reduce typing in the add-box flow.
4. Bulk-import a fuller parts catalog with real stats from a source you trust.
