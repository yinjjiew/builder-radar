import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { openCycle, syncCreatorsAndPosts } from "@/lib/sync";

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // First phase of the cycle, so it opens one for the later phases to join.
    const cycleId = await openCycle();
    return NextResponse.json({ ok: true, cycleId, ...(await syncCreatorsAndPosts(cycleId)) });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
