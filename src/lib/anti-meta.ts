import "server-only";
import type { PartRow, MetaComboRow } from "@/db/queries";
import { normalizeName } from "@/lib/meta";

const STAT_KEYS = ["attack", "defense", "stamina", "height", "dash", "burstResistance"] as const;
type StatKey = (typeof STAT_KEYS)[number];
type StatVector = Record<StatKey, number>;

const STAT_LABEL: Record<StatKey, string> = {
  attack: "Attack",
  defense: "Defense",
  stamina: "Stamina",
  height: "Height",
  dash: "Dash",
  burstResistance: "Burst Resistance",
};

const ZERO_VECTOR: StatVector = { attack: 0, defense: 0, stamina: 0, height: 0, dash: 0, burstResistance: 0 };

function partVector(part: PartRow): StatVector {
  return {
    attack: part.attack ?? 0,
    defense: part.defense ?? 0,
    stamina: part.stamina ?? 0,
    height: part.height ?? 0,
    dash: part.dash ?? 0,
    burstResistance: part.burstResistance ?? 0,
  };
}

function add(a: StatVector, b: StatVector): StatVector {
  const out = { ...ZERO_VECTOR };
  for (const k of STAT_KEYS) out[k] = a[k] + b[k];
  return out;
}

function mean(vectors: StatVector[]): StatVector {
  const out = { ...ZERO_VECTOR };
  if (vectors.length === 0) return out;
  for (const v of vectors) for (const k of STAT_KEYS) out[k] += v[k];
  for (const k of STAT_KEYS) out[k] /= vectors.length;
  return out;
}

function stddev(vectors: StatVector[], avg: StatVector): StatVector {
  const out = { ...ZERO_VECTOR };
  if (vectors.length === 0) return out;
  for (const v of vectors) for (const k of STAT_KEYS) out[k] += (v[k] - avg[k]) ** 2;
  for (const k of STAT_KEYS) out[k] = Math.sqrt(out[k] / vectors.length) || 1;
  return out;
}

// WBO's blade names don't always match the catalog's exactly — a CX blade's
// assist-letter suffix ("Brachiowhip OW") isn't recorded the same way in the
// archive. Same fallback as metaCombosForBlade() in lib/meta.ts: try the
// full name first, then the name with a short (<=3 char) trailing word
// dropped.
function resolveByName(name: string | null, byNormalized: Map<string, PartRow>): PartRow | undefined {
  if (!name) return undefined;
  const direct = byNormalized.get(normalizeName(name));
  if (direct) return direct;
  const words = name.trim().split(/\s+/);
  if (words.length > 1 && words[words.length - 1].length <= 3) {
    return byNormalized.get(normalizeName(words.slice(0, -1).join(" ")));
  }
  return undefined;
}

function byNameMap(parts: PartRow[]): Map<string, PartRow> {
  const map = new Map<string, PartRow>();
  for (const p of parts) map.set(normalizeName(p.name), p);
  return map;
}

export type AntiMetaPick = {
  bladeId: string;
  ratchetId: string | null;
  bitId: string;
  // Stats the current meta leans into most, and the stats this build
  // leans into instead — both are display-only labels, not further logic.
  metaLeans: string[];
  counters: string[];
};

// A candidate is scored by how much it deviates from the "typical" combo a
// player could build (the mean of every combo buildable from their owned
// parts) in the OPPOSITE direction from how the current meta deviates from
// that same baseline. This is a purely statistical complement — it has no
// notion of Beyblade X's actual type matchups (Attack/Defense/Stamina/
// Balance), just "the meta trends this way in stat-space, so here's the
// build that trends the other way" — see memory.md for why that's the
// chosen scope (the user picked this over a type-matchup heuristic).
export function computeAntiMetaPick(params: {
  ownedBlades: PartRow[];
  ownedRatchets: PartRow[];
  ownedBits: PartRow[];
  catalogParts: PartRow[];
  metaCombos: MetaComboRow[];
  topN?: number;
  minResolvedCombos?: number;
}): AntiMetaPick | null {
  const { ownedBlades, ownedRatchets, ownedBits, catalogParts, metaCombos, topN = 20, minResolvedCombos = 5 } = params;

  const bladeMap = byNameMap(catalogParts.filter((p) => p.type === "blade" || p.type === "blade_ratchet"));
  const ratchetMap = byNameMap(catalogParts.filter((p) => p.type === "ratchet"));
  const bitMap = byNameMap(catalogParts.filter((p) => p.type === "bit"));

  // metaCombos is already ranked best-first, but the catalog only covers a
  // fraction of every part WBO results mention — scanning until topN
  // RESOLVED combos are found (rather than resolving only the first topN
  // rows) still yields a profile built from the highest-ranked combos the
  // catalog can actually price, instead of quitting early on an unlucky
  // run of unresolvable top rows.
  const metaVectors: StatVector[] = [];
  for (const combo of metaCombos) {
    if (metaVectors.length >= topN) break;
    const blade = resolveByName(combo.bladeName, bladeMap);
    const bit = resolveByName(combo.bitName, bitMap);
    if (!blade || !bit) continue;
    const isIntegrated = blade.type === "blade_ratchet";
    if (!isIntegrated && !combo.ratchetName) continue;
    const ratchet = isIntegrated ? undefined : resolveByName(combo.ratchetName, ratchetMap);
    if (!isIntegrated && !ratchet) continue;
    metaVectors.push(add(add(partVector(blade), ratchet ? partVector(ratchet) : ZERO_VECTOR), partVector(bit)));
  }
  if (metaVectors.length < minResolvedCombos) return null;

  type Candidate = { bladeId: string; ratchetId: string | null; bitId: string; vector: StatVector };
  const candidates: Candidate[] = [];
  for (const blade of ownedBlades) {
    const isIntegrated = blade.type === "blade_ratchet";
    const bladeVec = partVector(blade);
    for (const bit of ownedBits) {
      const bitVec = partVector(bit);
      if (isIntegrated) {
        candidates.push({ bladeId: blade.id, ratchetId: null, bitId: bit.id, vector: add(bladeVec, bitVec) });
      } else {
        for (const ratchet of ownedRatchets) {
          candidates.push({
            bladeId: blade.id,
            ratchetId: ratchet.id,
            bitId: bit.id,
            vector: add(add(bladeVec, partVector(ratchet)), bitVec),
          });
        }
      }
    }
  }
  if (candidates.length === 0) return null;

  const metaProfile = mean(metaVectors);
  const poolMean = mean(candidates.map((c) => c.vector));
  const poolStd = stddev(candidates.map((c) => c.vector), poolMean);

  const metaZ = { ...ZERO_VECTOR };
  for (const k of STAT_KEYS) metaZ[k] = (metaProfile[k] - poolMean[k]) / poolStd[k];

  let best: Candidate | null = null;
  let bestScore = -Infinity;
  let bestZ: StatVector = ZERO_VECTOR;
  for (const c of candidates) {
    const z = { ...ZERO_VECTOR };
    let score = 0;
    for (const k of STAT_KEYS) {
      z[k] = (c.vector[k] - poolMean[k]) / poolStd[k];
      score -= z[k] * metaZ[k];
    }
    const totalStat = STAT_KEYS.reduce((s, k) => s + c.vector[k], 0);
    if (score > bestScore || (score === bestScore && best && totalStat > STAT_KEYS.reduce((s, k) => s + best!.vector[k], 0))) {
      best = c;
      bestScore = score;
      bestZ = z;
    }
  }
  if (!best) return null;

  const metaLeans = [...STAT_KEYS]
    .filter((k) => metaZ[k] > 0.15)
    .sort((a, b) => metaZ[b] - metaZ[a])
    .slice(0, 2)
    .map((k) => STAT_LABEL[k]);

  // Direction matters here, unlike metaLeans: "Attack" alone would be
  // ambiguous when the build counters a meta Attack-lean by having LESS
  // attack itself, not more of some other stat — so each entry says which.
  const counters = [...STAT_KEYS]
    .filter((k) => bestZ[k] * metaZ[k] < 0)
    .sort((a, b) => bestZ[a] * metaZ[a] - bestZ[b] * metaZ[b])
    .slice(0, 2)
    .map((k) => `${bestZ[k] > 0 ? "high" : "low"} ${STAT_LABEL[k]}`);

  return { bladeId: best.bladeId, ratchetId: best.ratchetId, bitId: best.bitId, metaLeans, counters };
}
