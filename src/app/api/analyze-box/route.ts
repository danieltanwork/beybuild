import { NextResponse } from "next/server";
import { stackServerApp } from "@/lib/stack";
import { analyzeBoxPhotos } from "@/lib/vision";

export async function POST(request: Request) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { photoUrls } = (await request.json()) as { photoUrls?: string[] };
  const urls = (photoUrls ?? []).filter(Boolean);

  if (urls.length === 0) {
    return NextResponse.json({ error: "No photos provided" }, { status: 400 });
  }

  try {
    const analysis = await analyzeBoxPhotos(urls);
    return NextResponse.json(analysis);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Couldn't analyze the photos",
      },
      { status: 502 },
    );
  }
}
