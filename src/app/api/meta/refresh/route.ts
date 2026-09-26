import { NextResponse } from "next/server";
import { fetchMetaCombos, META_SOURCE } from "@/lib/meta";
import { replaceMetaCombos } from "@/db/queries";

// Called weekly by Vercel Cron (see vercel.json), which sends
// `Authorization: Bearer $CRON_SECRET`. `?secret=` is also accepted so a
// refresh can be triggered by just opening the URL in a browser.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secretParam = new URL(request.url).searchParams.get("secret");
  const authorized =
    auth === `Bearer ${process.env.CRON_SECRET}` || secretParam === process.env.CRON_SECRET;
  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await fetchMetaCombos();
  if (!result.ok) {
    return NextResponse.json({ error: "Fetch failed", detail: result.error }, { status: 502 });
  }

  await replaceMetaCombos(META_SOURCE, result.combos);

  return NextResponse.json({
    source: META_SOURCE,
    dataAsOf: result.dataAsOf,
    eventsInWindow: result.eventsInWindow,
    comboCount: result.combos.length,
    top10: result.combos.slice(0, 10).map((c) => `${c.comboName} (${c.topFinishes} top-3s)`),
  });
}
