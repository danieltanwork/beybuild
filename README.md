# BeyBuild

A mobile-first PWA for tracking your Beyblade X collection and building combos from the parts you actually own.

## Stack

- **Next.js 16** (App Router, TypeScript, Tailwind CSS)
- **Neon** (Postgres) via `@neondatabase/serverless` + Drizzle ORM
- **Neon Auth** (Stack Auth) for login — Google/GitHub sign-in work out of the box with no extra setup
- **Neon's built-in S3-compatible object storage** for box/part photos (via `@aws-sdk/client-s3` + presigned URLs) — no separate storage provider needed
- **Neon's built-in AI Gateway** for reading box photos (OpenAI-compatible `/v1/chat/completions`, calling a Claude vision model) — same one-provider pattern as storage
- A hand-rolled service worker + manifest for installability (Add to Home Screen)

## What's here

- `/` — dashboard (parts owned, builds saved, quick actions)
- `/inventory` — your boxes, grouped, with each part's photo
- `/inventory/add` — log a new box: photo the box + each part, name each part (autocompletes against parts you've already logged)
- `/build` — visual picker: tap a Blade, Ratchet, and Bit from your own inventory to assemble and save a combo
- `/handler/*` — auto-generated Stack Auth sign-in/sign-up/account pages
- `/api/upload-url` — issues a short-lived presigned PUT URL for the Neon storage bucket; `PhotoCapture` uploads directly to it from the browser
- `/api/analyze-box` — sends the front/back box photo URLs to a vision model via Neon AI Gateway and returns extracted `{boxCode, boxName, bladeName, ratchetName, bitName}`; the add-box form pre-fills its fields from this but never auto-submits — you always review/edit before saving

Data model (`src/db/schema.ts`):
- `parts` — the global catalog (one row per distinct Blade/Ratchet/Bit, shared across all users). Each part has one canonical `image_url`, set automatically the first time any user photographs that part ("first photo wins").
- `inventory` — what a specific user owns. Three rows per box (one per part), grouped by a shared `box_id`.
- `builds` — saved Blade + Ratchet + Bit combos per user.

## Why Neon storage instead of a separate provider

Neon projects include a branchable, S3-compatible object storage bucket alongside the Postgres database. `src/lib/storage.ts` uses standard AWS SDK v3 calls (`PutObjectCommand` + `getSignedUrl`) against that bucket with `forcePathStyle: true`, so there's no third-party storage account to set up — photo uploads live on the same Neon project as everything else. The bucket (`beybuild-photos`) is `public_read`, so uploaded photo URLs are plain HTTPS links with no signing needed to view them; only uploads require the presigned URL.

## Photo analysis: how it works, and its limits

`src/lib/vision.ts` sends the front/back box photo URLs to `VISION_MODEL` (default `anthropic/claude-sonnet-4-5`) through Neon's AI Gateway and asks for exactly five fields back as JSON, with an explicit instruction not to guess a value it can't actually read. The route returns whatever it got — the form fills in only the fields that came back non-null, and everything stays editable; nothing is auto-submitted. If the gateway call fails (bad model slug, network issue, unreadable photo) the UI shows an inline error and falls back to plain manual entry rather than blocking you.

**One thing I couldn't verify from here:** the exact model slug (`anthropic/claude-sonnet-4-5`) is my best read of Neon's AI Gateway docs, not a live-tested value — this sandbox's network policy blocks direct calls to `*.neon.tech`, so I couldn't confirm it end-to-end. If "Fill in from photos" errors out on your phone, check the Neon console's AI Gateway page for the exact catalog slug and tell me — it's a one-line env var fix (`VISION_MODEL` on Vercel).

## What's deliberately NOT built yet

- **Barcode scanning.** The box UPC could resolve a set instantly via a barcode scan instead of a photo, but that needs its own UPC→product mapping built up over time; photo analysis covers the same need today.
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
- Neon AI Gateway enabled, with a scoped `ai_gateway:invoke` credential issued for the app to use.
- Vercel project **`beybuild`** has all required env vars set for production/preview/development: `DATABASE_URL`, `NEXT_PUBLIC_STACK_PROJECT_ID`, `NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY`, `STACK_SECRET_SERVER_KEY`, `NEON_STORAGE_*` (5 vars), `NEON_AI_GATEWAY_BASE_URL`, `NEON_AI_GATEWAY_TOKEN`, `VISION_MODEL`. Nothing manual left to configure.
- Framework is explicitly pinned to `nextjs` via `vercel.json` (the Vercel project was originally created bare via API before being connected to git, which left its framework setting `null` and caused every route to 404 despite successful builds — worth knowing if you ever see that again after recreating the project).

## Suggested next steps

1. Try "Fill in from photos" on a real box on your phone and see how the extraction quality is; tune the prompt in `src/lib/vision.ts` based on what it gets wrong.
2. Bulk-import a fuller parts catalog with real stats from a source you trust.
3. Consider barcode scanning as a faster path once you have a UPC→product mapping built up.
