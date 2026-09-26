import "server-only";

// A community-maintained archive of WBO's "Winning Combinations at WBO
// Organized Events" thread, already parsed into per-event top-3 placements.
// WBO's own forum 403s server-side fetches (bot protection that also rejects
// browser-shaped headers), and metabeys.com is a client-rendered SPA — a
// static JSON file on GitHub has neither problem. Freshness depends on the
// archive's maintainer; `dataAsOf` in the refresh response shows how recent
// it actually is.
const ARCHIVE_URL =
  "https://raw.githubusercontent.com/catgamer109/WBO-BBX-Winning-Combos-Data-Archive/main/compiled_data/extracted_data.json";
export const META_SOURCE = "WBO tournaments";

const WINDOW_DAYS = 90;
const RANK_WEIGHT: Record<string, number> = { "1st": 3, "2nd": 2, "3rd": 1 };

type ArchiveEvent = {
  event_date?: string;
  placements?: { rank?: string; combos?: string[] }[];
};

export type MetaComboStat = {
  bladeName: string;
  ratchetName: string | null;
  bitName: string;
  comboName: string;
  placementScore: number;
  topFinishes: number;
  lastSeen: string;
};

export function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Dates come as either "2026-07-12" or "Sun. September 6, 2026".
function parseEventDate(s: string | undefined): Date | null {
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(`${s.slice(0, 10)}T00:00:00Z`);
  const t = Date.parse(`${s.replace(/^[A-Za-z]{3}\.?\s+/, "")} UTC`);
  return Number.isNaN(t) ? null : new Date(t);
}

// "SharkScale 1-70LR", "EmperorBlast H9-60K" (CX: assist-blade letters before
// the ratchet), "GloryValkyrie R" (ratchet-integrated blade, bit only),
// "Lightning L-Drago (Upper Type) 1-60E". The CX assist letters are dropped:
// WBO's letter codes don't consistently match how the catalog names those
// blades, and the ratchet+bit suggestion is what matters here.
const WITH_RATCHET = /^(.+?)\s+[A-Z]{0,3}(\d+-\d+)\s*([A-Z][A-Za-z]{0,2})$/;
const BIT_ONLY = /^(.+?)\s+([A-Z][A-Za-z]{0,2})$/;

function parseCombo(raw: string) {
  const s = raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const m = s.match(WITH_RATCHET);
  if (m) return { blade: m[1], ratchet: m[2], bit: m[3] };
  const b = s.match(BIT_ONLY);
  if (b) return { blade: b[1], ratchet: null, bit: b[2] };
  return null;
}

export type MetaFetchResult =
  | { ok: true; combos: MetaComboStat[]; eventsInWindow: number; dataAsOf: string }
  | { ok: false; error: string };

export async function fetchMetaCombos(): Promise<MetaFetchResult> {
  let events: ArchiveEvent[];
  try {
    const res = await fetch(ARCHIVE_URL, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status} ${res.statusText} from ${ARCHIVE_URL}` };
    events = await res.json();
  } catch (err) {
    return { ok: false, error: `${err instanceof Error ? err.message : String(err)} fetching ${ARCHIVE_URL}` };
  }
  if (!Array.isArray(events)) return { ok: false, error: "Archive JSON is not an array" };

  const dated = events
    .map((e) => ({ e, date: parseEventDate(e.event_date) }))
    .filter((x): x is { e: ArchiveEvent; date: Date } => x.date !== null);
  if (dated.length === 0) return { ok: false, error: "No dated events in archive" };

  // Window is anchored to the newest event in the archive rather than today,
  // so a lagging archive still yields suggestions instead of nothing.
  const latest = Math.max(...dated.map((x) => x.date.getTime()));
  const cutoff = latest - WINDOW_DAYS * 86_400_000;

  const byKey = new Map<string, MetaComboStat>();
  let eventsInWindow = 0;
  for (const { e, date } of dated) {
    if (date.getTime() < cutoff) continue;
    eventsInWindow++;
    const day = date.toISOString().slice(0, 10);
    for (const p of e.placements ?? []) {
      const weight = RANK_WEIGHT[p.rank ?? ""];
      if (!weight) continue;
      for (const raw of p.combos ?? []) {
        const c = parseCombo(raw);
        if (!c) continue;
        const key = `${normalizeName(c.blade)}|${c.ratchet ?? ""}|${c.bit.toLowerCase()}`;
        const stat = byKey.get(key) ?? {
          bladeName: c.blade,
          ratchetName: c.ratchet,
          bitName: c.bit,
          comboName: `${c.blade} ${c.ratchet ?? ""}${c.bit}`,
          placementScore: 0,
          topFinishes: 0,
          lastSeen: day,
        };
        stat.placementScore += weight;
        stat.topFinishes += 1;
        if (day > stat.lastSeen) stat.lastSeen = day;
        byKey.set(key, stat);
      }
    }
  }

  const combos = [...byKey.values()].sort((a, b) => b.placementScore - a.placementScore);
  return { ok: true, combos, eventsInWindow, dataAsOf: new Date(latest).toISOString().slice(0, 10) };
}

// Catalog CX blades carry an assist suffix ("Brachiowhip OW") that WBO's data
// doesn't share, so fall back to the name without a short trailing token.
export function metaCombosForBlade<T extends { bladeName: string }>(
  bladeName: string,
  combos: T[],
  limit: number,
): T[] {
  const keys = [normalizeName(bladeName)];
  const words = bladeName.trim().split(/\s+/);
  if (words.length > 1 && words[words.length - 1].length <= 3) {
    keys.push(normalizeName(words.slice(0, -1).join(" ")));
  }
  for (const key of keys) {
    const matches = combos.filter((c) => normalizeName(c.bladeName) === key);
    if (matches.length > 0) return matches.slice(0, limit);
  }
  return [];
}
