import { NextRequest, NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { buildNetwork, NETWORK_DEFAULTS } from "@/lib/network";

export const maxDuration = 300;

/**
 * Rebuilds the follow graph. Kept off the cron schedule on purpose: X bills
 * $0.010 for every account returned from a following list, so running this every
 * six hours would cost more than the rest of the project combined.
 *
 * Call with ?dry=1 first to see what a given budget would cost before spending it.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const scouts = Number(params.get("scouts") ?? NETWORK_DEFAULTS.scouts);
  const perScout = Number(params.get("perScout") ?? NETWORK_DEFAULTS.perScout);

  if (!Number.isFinite(scouts) || !Number.isFinite(perScout)) {
    return NextResponse.json({ error: "scouts and perScout must be numbers" }, { status: 400 });
  }

  const bounded = {
    scouts: Math.max(1, Math.min(scouts, 60)),
    perScout: Math.max(1, Math.min(perScout, 200))
  };
  const worstCase = Number((bounded.scouts * bounded.perScout * 0.01).toFixed(2));

  if (params.get("dry")) {
    return NextResponse.json({ ok: true, dryRun: true, ...bounded, worstCaseCostUsd: worstCase });
  }

  try {
    const result = await buildNetwork(bounded);
    return NextResponse.json({ ok: true, worstCaseCostUsd: worstCase, ...result });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
