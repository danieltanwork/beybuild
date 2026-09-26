# BeyBuild — durable notes for future sessions

This file holds decisions and lessons that should survive context resets —
not a changelog (see `progress.md` for that), just the things worth knowing
before touching this code again.

## Architecture as it actually stands today

- **Vision calls go straight to the Anthropic API** (`@anthropic-ai/sdk`,
  `src/lib/vision.ts`), not through Neon's AI Gateway. The gateway was the
  original plan (see old README) but was dropped early (`bbc910f`) — this
  sandbox can't reach `*.neon.tech` to verify gateway behavior, and calling
  Anthropic directly removed that whole class of doubt.
- Model: `process.env.VISION_MODEL || "claude-sonnet-5"`. Bumped to Sonnet
  from a cheaper tier early on (`75c5bab`) — a cheaper model mixed up which
  number belonged to which stat block on a real box.
- **Storage** is Neon's built-in S3-compatible bucket (`src/lib/storage.ts`),
  not Vercel Blob (swapped in `f2251da`). Two upload paths: `createUploadUrl`
  (presigned PUT, used by the browser's `PhotoCapture` component) and
  `uploadBuffer` (direct `s3.send(PutObjectCommand)`, used server-side for
  images the server generates itself, e.g. reference-sheet crops).
- **`parts` is a single global catalog**, not per-user — one row per distinct
  Blade/Ratchet/Bit, unique on `(type, name)`. `inventory` rows are what a
  specific user owns, referencing that shared catalog. A part's `image_url`
  is catalog-wide: setting it (from a box photo or the parts-library import)
  makes that photo appear for every user's copy of that part, past and
  future.

## Vision-extraction patterns that turned out to matter

- **Never ask a model to both transcribe a number AND classify what it
  belongs to in the same step.** Early box-analysis prompts asked for
  blade/ratchet/bit stats directly and the model kept swapping which block
  belonged to which part (`8d30390`, `90eeb40`), even a full cyclic shift
  across all three. The fix that actually held (`207b1d7`): have the model
  emit raw, untyped stat blocks (just whichever bars are grouped together,
  in print order), then classify each block **in code** by which stats it
  contains — a block with `height` is always the ratchet, one with
  `dash`/`burstResistance` is always the bit, anything else is the blade.
  Verified 24/24 correct across two real boxes after this change and it's
  held up since.
- **Bounding-box localization is a much harder, separate problem from
  number-reading**, and it stayed unreliable through several redesigns:
  - Asking for one box per part *bundled into* the main stats call: bad —
    landed on character portraits, trademark logos, plain text.
  - A fully isolated call per part ("where exactly is this one picture?")
    with only generic shape hints: still bad (~1/8 correct).
  - Isolated calls with positional priors (vertical stacking order,
    horizontal column position): no better, sometimes worse.
  - Conclusion after all of that (see `6881599`): **auto-cropping icons out
    of a busy box photo isn't worth pursuing further** — abandoned in favor
    of manual take/upload, which already worked fine.
- **Reference sheets are a different, much more tractable problem** than box
  photos — a clean grid of icons on white background, each with an explicit
  printed code label, isolated with whitespace on all sides. This is what
  the `/inventory/parts-library` import (`57d37b5` onward) is built on. Even
  here, per-cell box estimation was unreliable on dense grids; what actually
  works (`78c66a5`) is asking the model for **row-level structure only**
  (each row's codes + that row's left/right extent) and computing each
  cell's position by simple even division — arithmetic instead of per-cell
  guessing. Row *height* still needs independent per-row estimation, not an
  evenly-divided grid height (`5374f24`) — a sheet mixing small bits with one
  much taller fully-assembled top broke the "all rows same height"
  assumption. The last row's own top-edge estimate is the least reliable of
  any row (nothing below it to calibrate against) — worth extra skepticism
  there specifically if this ever needs revisiting.
- **A generous crop padding + `sharp().trim()` beats a tight, precise box.**
  Once cropped, `trim()` (materialized to its own buffer — chaining
  `.extract().trim()` in one pipeline intermittently threw sharp's "bad
  extract area") tightens away the slack. It can't undo genuine bleed from a
  touching neighbor cell, just excess whitespace.
- **Bit reference sheets print full descriptive names** ("Gear Flat",
  "Turbo"), but the parts catalog stores bits by the short abbreviation a
  *box* actually prints ("GF", "T") — see `deriveBitAbbreviation` in
  `vision.ts`. Every bit in the catalog matches taking the first letter of
  each word. Known, accepted collisions: "Turbo"/"Taper" → "T",
  "Operate"/"Orb" → "O".
- **Stats aren't always whole numbers.** A CX-line ratchet printed Defense
  8.5 / Stamina 9.5 — the extraction schema required integers, so the
  *entire* box failed validation, not just those two fields (`bb30028`).
  Fixed to read decimals; the user chose to round to the nearest integer at
  save time rather than migrate `parts`' stat columns off `integer` (see
  "Decisions the user made" below).

## Environment quirks worth remembering

- This **sandbox's network egress proxy blocks most hobby/community sites**
  by default (confirmed for `worldbeyblade.org`, `metabeys.com`,
  `beyxhub.org`, `bbxhub.net`, `bbx-meta.pages.dev`, `beywatch.gg`, and
  `*.neon.tech`). The user can add hosts to the environment's egress
  allowlist, but **that change doesn't appear to retroactively apply to an
  already-running session** — a fresh session picks it up, the current one
  didn't. Don't try to route around a block (no disabling TLS verification,
  no unsetting `HTTPS_PROXY`) — report it and suggest a new session instead.
  This is sandbox-only: the deployed Vercel app's own outbound requests are
  not subject to this sandbox's proxy.
- **AWS SDK v3 checksum trailers break Neon's S3-compatible endpoint** for a
  direct `s3.send(PutObjectCommand)` (presigned-URL uploads are unaffected).
  Fix already in `storage.ts`: `requestChecksumCalculation: "WHEN_REQUIRED"`,
  `responseChecksumValidation: "WHEN_REQUIRED"` on the `S3Client`.
- React `useState(initialValue)` only reads its initial value once, on
  mount — a component that receives an updated prop later (e.g. an
  auto-filled photo URL arriving after an async call) won't pick it up
  without a remount (a `key` bump) or lifting the state up.

## Decisions the user made (don't silently revisit)

- **Stats stay `integer` columns in `parts`.** Offered a migration to
  `numeric` to preserve decimal stats losslessly; declined in favor of
  rounding at save time. Any part with a printed decimal stat will show
  rounded in the app from here on, by choice.
- **Auto-crop from box photos was removed entirely** (not merely disabled)
  after repeated testing showed it couldn't be made reliable — replaced by
  manual take/upload. Don't re-add a "bundled" or box-photo-based auto-crop
  without re-litigating why it was pulled (see above).
- **Photo inputs allow gallery picking, not camera-only** — `capture`
  attribute was intentionally dropped from the file input across the app
  (not just the parts-library flow) since forcing the camera blocked
  picking an existing photo (needed for importing reference sheets, which
  are saved images, not something you'd photograph live).

## Meta suggestions: where the data comes from and why

- **Source: a public GitHub archive of the WBO "Winning Combinations"
  thread**, `catgamer109/WBO-BBX-Winning-Combos-Data-Archive`, file
  `compiled_data/extracted_data.json` (~4.4MB, ~3,000 events, structured
  top-3 placements with combo strings like `SharkScale 1-70LR`). Parsed
  deterministically, no AI extraction. Freshness depends on that
  maintainer (active as of Sept 2026); the refresh response's `dataAsOf`
  shows how current it is.
- **Tried and abandoned:** `metabeys.com` is a client-rendered SPA (a
  server fetch sees a ~1.7KB empty shell); `worldbeyblade.org` returns 403
  to Vercel's servers even with browser-shaped headers (IP-level bot
  protection). Don't retry either without a new idea. Residential-proxy
  scraping services were deliberately not used: they work around a block
  the site chose to put up.
- **Ranking:** weighted top-3 finishes (1st=3, 2nd=2, 3rd=1) over the 90
  days before the archive's *newest* event (not today), so a lagging
  archive still yields suggestions.
- **CX blades:** WBO notation puts assist-blade letters before the ratchet
  (`EmperorBlast H9-60K`), and those letters don't match the catalog's own
  suffixes ("Brachiowhip OW" vs WBO's "OH"/"PH"). Parsing drops them, and
  blade lookup falls back to the catalog name minus a short (≤3 char)
  trailing token.
- **Sandbox rule:** never fetch, or build something that fetches, content
  from a sandbox-blocked host and then read it back here (e.g. calling the
  deployed refresh endpoint while it pulled from a blocked site). That's
  refused as containment escape. Have the user open such URLs and paste
  the result. GitHub raw files aren't blocked, so the current source can be
  tested locally.
