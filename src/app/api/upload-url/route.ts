import { NextResponse } from "next/server";
import { stackServerApp } from "@/lib/stack";
import { createUploadUrl } from "@/lib/storage";

export async function POST(request: Request) {
  const user = await stackServerApp.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { filename, contentType } = (await request.json()) as {
    filename: string;
    contentType: string;
  };

  if (!filename || !contentType) {
    return NextResponse.json({ error: "Missing filename or contentType" }, { status: 400 });
  }

  const { uploadUrl, publicUrl } = await createUploadUrl(filename, contentType);
  return NextResponse.json({ uploadUrl, publicUrl });
}
