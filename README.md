# BeyBuild

A mobile-first PWA for tracking your Beyblade X collection and building combos from the parts you actually own.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS)
- **Neon** (Postgres) via `@neondatabase/serverless` + Drizzle ORM
- **Neon Auth** (Stack Auth) for login — Google/GitHub sign-in work out of the box with no extra setup
- **Neon's built-in S3-compatible object storage** for box/part photos (via `@aws-sdk/client-s3` + presigned URLs) — no separate storage provider needed
- A hand-rolled service worker + manifest for installability (Add to Home Screen)

## What's here

- `/` — dashboard (parts owned, builds saved, quick actions)
- `/inventory` — your boxes, grouped, with each part's photo
- `/inventory/add` — log a new box: photo the box + each part, name each part (autocompletes against parts you've already logged)
- `/build` — visual picker: tap a Blade, Ratchet, and Bit from your own inventory to assemble and save a combo
- `/handler/*` — auto-generated Stack Auth sign-in/sign-up/account pages
- `/api/upload-url` — issues a short-lived presigned PUT URL for the Neon storage bucket; `PhotoCapture` uploads directly to it from the browser

Data model (`src/db/schema.ts`):
- `parts` — the global catalog (one row per distinct Blade/Ratchet/Bit, shared across all users). Each part has one canonical `image_url`, set automatically the first time any user photographs that part ("first photo wins").
- `inventory` — what a specific user owns. Three rows per box (one per part), grouped by a shared `box_id`.
- `builds` — saved Blade + Ratchet + Bit combos per user.

## Why Neon storage instead of a separate provider

Neon projects include a branchable, S3-compatible object storage bucket alongside the Postgres database. `src/lib/storage.ts` uses standard AWS SDK v3 calls (`PutObjectCommand` + `getSignedUrl`) against that bucket with `forcePathStyle: true`, so there's no third-party storage account to set up — photo uploads live on the same Neon project as everything else. The bucket (`beybuild-photos`) is `public_read`, so uploaded photo URLs are plain HTTPS links with no signing needed to view them; only uploads require the presigned URL.

## What's deliberately NOT built yet

- **OCR / barcode auto-fill.** Adding a box currently asks you to type the part names (with autocomplete) rather than reading them automatically from a photo. This was left out rather than half-wired: an unreliable auto-fill is worse than a fast manual flow. The photo capture UI is already in place, so this can be layered on top later (Tesseract.js for the product code, or a barcode scan) without changing the data model.
- **Full parts catalog.** Only one verified example part (Phoenix Wing / 9-60 / GF) is seeded — I didn't want to fabricate stat numbers I couldn't verify. The catalog grows organically as you log your own boxes, or you can bulk-import a community parts list later.
- **Stat numbers on parts.** The schema has `attack`/`defense`/`stamina`/`weight_g` columns ready to use, but they're left null until sourced from somewhere verifiable.

## Local setup

1. `.env.local` is already populated in this environment with real values (Neon Postgres, Neon Auth, Neon storage) — see `.env.example` for the shape if you need to recreate it elsewhere.
2. `npm install`
3. `npm run dev`

## Already provisioned for you

- Neon project **`beybuild`** (`gentle-lab-03321101`), schema applied (`parts`, `inventory`, `builds`).
- Neon Auth enabled (Stack provider) — Google and GitHub sign-in are enabled by default with shared credentials, no OAuth app setup needed.
- Neon object storage bucket **`beybuild-photos`** (`public_read`), with a scoped `storage:read`/`storage:write` credential issued for the app to use.
- Vercel project **`beybuild`** has all required env vars set for production/preview/development: `DATABASE_URL`, `NEXT_PUBLIC_STACK_PROJECT_ID`, `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`, `STACK_SECRET_SERVER_KEY`, `NEON_STORAGE_ENDPOINT`, `NEON_STORAGE_REGION`, `NEON_STORAGE_BUCKET`, `NEON_STORAGE_ACCESS_KEY_ID`, `NEON_STORAGE_SECRET_ACCESS_KEY`. Nothing manual left to configure.

## Suggested next steps

1. Deploy and try the golden path on your phone: sign in → add a box with real photos → build a combo.
2. Layer in OCR (Tesseract.js, client-side) or barcode scanning to reduce typing in the add-box flow.
3. Bulk-import a fuller parts catalog with real stats from a source you trust.
