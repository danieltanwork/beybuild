import { NextResponse } from "next/server";
import { fetchMetaCombos } from "@/lib/meta";
import { upsertMetaCombos } from "@/db/queries";

// Called on a schedule (see vercel.json's "crons") to refresh the
// competitive-meta combo data used for Build-page suggestions. Vercel signs
// its own cron requests with `Authorization: Bearer $CRON_SECRET` — this
// also doubles as the manual-trigger auth for checking on the scrape by
// hand while it's still unverified against the source site's real structure.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await fetchMetaCombos();
  if (!result) {
    return NextResponse.json({ error: "Fetch failed" }, { status: 502 });
  }

  await upsertMetaCombos(result.source, result.combos);

  return NextResponse.json({
    source: result.source,
    fetchedLength: result.fetchedLength,
    comboCount: result.combos.length,
    combos: result.combos,
  });
}
