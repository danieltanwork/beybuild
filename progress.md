# BeyBuild — progress log

Deployed at https://beybuild.vercel.app. Repo branch:
`claude/beyblade-inventory-research-glj8ac`. See `memory.md` for durable
architecture decisions/lessons; this file is the status + chronological
record.

## Current state (as of this update)

**Built and live:**
- Auth (Neon Auth / Stack), Postgres schema (`parts`, `inventory`,
  `builds`), Neon object storage for photos.
- `/inventory` — list boxes, grouped by box, each part's photo shown.
- `/inventory/add` and `/inventory/[boxId]/edit` — log/edit a box: photo
  front/back, "Fill in from photos" (AI extraction), manual override on
  every field, supports both single-bey (Starter/Booster) and 3-bey (Deck
  Set) boxes, and ratchet-integrated blades (fused blade+ratchet, e.g.
  Hellsnether).
- `/build` — visual picker: assemble a Blade+Ratchet+Bit combo from parts
  the user actually owns, save it.
- `/inventory/parts-library` — import part photos in bulk from a reference
  sheet (a grid of icons + codes, like the official Beyblade X category
  sheets). Detects each icon, matches it to the shared parts catalog, shows
  a review grid (matched/unmatched, already-has-a-photo state) before
  writing anything. One-time backfill semantics, not an ongoing sync.
- Box-photo analysis handles decimal stats (e.g. a CX-line ratchet's
  Defense 8.5) — rounds to nearest integer at save time.
- **Meta picks on `/build`** — for the selected blade, the top 3
  ratchet+bit combos by WBO top-3 finishes (last 90 days of the archive),
  each with a count, a "Need X" warning for unowned parts, and a Use
  button. Data is refreshed weekly by Vercel Cron (`/api/meta/refresh`,
  Mondays 06:00 UTC), or manually via `?secret=$CRON_SECRET`.

**Known limitations, by design or by accepted tradeoff:**
- No auto-crop from box photos — removed after extensive testing showed it
  couldn't be made reliable (see `memory.md`). Part photos are manual
  take/upload, or bulk-imported via the parts-library reference-sheet flow.
- Parts catalog stat columns are `integer` — a decimal printed stat rounds
  on save (user's explicit choice over a schema migration).
- The parts-library import's row-height estimation for a sheet's *last* row
  is measurably less reliable than other rows in testing (no row below it
  to calibrate against) — mitigated but not eliminated; worth a visual
  double-check on a squeezed last row before saving.
- A few bit-name abbreviation collisions are possible ("Turbo"/"Taper" → T,
  "Operate"/"Orb" → O) — surfaced in the review UI, not silently resolved.

## Changelog (chronological, most recent first)

- **Meta picks on the Build page** — tried MetaBeys (SPA, empty shell) and
  the WBO forum directly (403 to Vercel), then switched to a public GitHub
  archive of WBO results with structured placements. `meta_combos` gained
  `placement_score`/`top_finishes`/`last_seen`; each refresh replaces the
  source's rows atomically. See `memory.md` for the reasoning.

- **Decimal stats** — a CX-18 box's ratchet prints Defense 8.5/Stamina 9.5;
  the extraction schema required integers so the *whole* box failed to
  read. Fixed to accept decimals in extraction; rounds to nearest integer
  at save (user declined a DB migration to `numeric`).
- **Parts-library crop rearchitecture** (multiple rounds, same underlying
  feature) — the reference-sheet import went through several fixes as real
  sheets surfaced new failure modes: gallery-vs-camera-only photo picking,
  one-time-import semantics (don't overwrite an existing photo by default),
  bit full-name → abbreviation matching, "box the whole cell not just the
  icon" (label-anchoring was cutting icons off), square white-canvas
  compositing (bit crops are naturally tall/narrow — object-cover was
  re-cropping them), neighbor-bleed on dense grids, and finally a
  rearchitecture from per-cell box estimation to row-level structure +
  arithmetic column division, then per-row (not evenly-divided) height
  estimation once a sheet with uneven row heights surfaced. See `memory.md`
  for the reasoning; `git log` has the individual commits.
- **Auto-crop from box photos: built, tested extensively, then removed.**
  Tried bundled-call, isolated-call, and positional-prior variants; none
  got past roughly 1-in-8 correct on real boxes. Reverted to manual
  photo entry rather than ship something unreliable.
- **Deck Set support** — boxes with 3 beyblades, not just 1; ratchet-
  integrated blades (fused blade+ratchet); retry-once on schema-validation
  flake; classify-in-code stat-block architecture (see `memory.md`) after
  the model kept swapping which stat block belonged to which part.
- **UI passes** — neon/futuristic theme, per-part carousel build picker,
  redesigned home page and inventory cards, box editing (fix/delete after
  the fact).
- **Foundation** — scaffolded Next.js + Neon + Neon Auth, switched storage
  from Vercel Blob to Neon's built-in bucket, switched vision calls from
  Neon AI Gateway to calling Anthropic directly, pinned the Vercel
  framework setting (was silently causing 404s on every route).

## In progress / next up

- **Meta picks: verify in production** — first refresh against the GitHub
  archive needs the user to open the refresh URL (the sandbox can't reach
  the deployed app). Watch whether the archive keeps updating: WBO may be
  moving results into "leagues" for Season 3, and the maintainer's commits
  mention removing events "already on leagues".
- Unused `win_rate`/`pick_rate`/`tier` columns on `meta_combos` could be
  dropped (destructive migration, so ask first).
