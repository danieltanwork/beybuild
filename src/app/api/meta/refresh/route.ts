import { NextResponse } from "next/server";
import { fetchMetaCombos } from "@/lib/meta";
import { upsertMetaCombos } from "@/db/queries";

// Called on a schedule (see vercel.json's "crons") to refresh the
// competitive-meta combo data used for Build-page suggestions. Vercel signs
// its own cron requests with `Authorization: Bearer $CRON_SECRET`. A
// `?secret=` query param is accepted too — a header can't be attached just
// by opening a URL in a browser, which is the easiest way to manually check
// on the scrape while it's still unverified against the source site's real
// structure.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secretParam = new URL(request.url).searchParams.get("secret");
  const authorized =
    auth === `Bearer ${process.env.CRON_SECRET}` || secretParam === process.env.CRON_SECRET;
  if (!authorized) {
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
