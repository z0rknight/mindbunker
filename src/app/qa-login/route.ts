import { createAuthSession } from "@/lib/auth-server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const supplied = request.nextUrl.searchParams.get("token");
  if (
    process.env.NODE_ENV !== "development" ||
    !process.env.MB_PROJECT_QA_LOGIN_TOKEN ||
    supplied !== process.env.MB_PROJECT_QA_LOGIN_TOKEN
  ) {
    return new NextResponse(null, { status: 404 });
  }

  await createAuthSession();
  return NextResponse.redirect(new URL("/mindbunker/crm", request.url));
}
