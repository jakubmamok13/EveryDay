// Duplicate guard and Master Copy (D-024, D-029).

export type RideSource = "mywhoosh" | "bolt" | "fenix" | "upload" | "other";

export interface RideForDedup {
  id: string;
  startMs: number;
  durationSec: number;
  source: RideSource;
  indoor: boolean;
  hasPower: boolean;
}

const PRIORITY_INDOOR: RideSource[] = ["mywhoosh", "upload", "bolt", "fenix", "other"];
const PRIORITY_OUTDOOR: RideSource[] = ["bolt", "fenix", "upload", "mywhoosh", "other"];

function overlaps(a: RideForDedup, b: RideForDedup): boolean {
  const aEnd = a.startMs + a.durationSec * 1000;
  const bEnd = b.startMs + b.durationSec * 1000;
  const overlap = Math.min(aEnd, bEnd) - Math.max(a.startMs, b.startMs);
  const shorter = Math.min(a.durationSec, b.durationSec) * 1000;
  const similar = Math.abs(a.durationSec - b.durationSec) <= Math.max(a.durationSec, b.durationSec) * 0.15;
  return shorter > 0 && overlap >= shorter * 0.5 && similar;
}

function rank(r: RideForDedup, indoorGroup: boolean): number {
  const order = indoorGroup ? PRIORITY_INDOOR : PRIORITY_OUTDOOR;
  return order.indexOf(r.source) * 2 + (r.hasPower ? 0 : 1);
}

/** Returns duplicateOf for every non-master ride (masters are absent from the map). */
export function findDuplicates(rides: RideForDedup[]): Map<string, string> {
  const dup = new Map<string, string>();
  const sorted = [...rides].sort((a, b) => a.startMs - b.startMs);
  const groups: RideForDedup[][] = [];
  for (const r of sorted) {
    const g = groups.find((grp) => grp.some((x) => overlaps(x, r)));
    if (g) g.push(r);
    else groups.push([r]);
  }
  for (const g of groups) {
    if (g.length < 2) continue;
    const indoor = g.some((r) => r.indoor);
    const master = [...g].sort((a, b) => rank(a, indoor) - rank(b, indoor))[0]!;
    for (const r of g) if (r.id !== master.id) dup.set(r.id, master.id);
  }
  return dup;
}
