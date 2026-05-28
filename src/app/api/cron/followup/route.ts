import { NextResponse, type NextRequest } from "next/server";
import { processarFollowupsPendentes } from "@/lib/caio/followup";

/**
 * Disparado pelo crontab no VPS a cada minuto.
 * Auth via header `Authorization: Bearer <CRON_SECRET>` (env var).
 *
 * Crontab:
 *   * * * * * curl -sS -X POST -H "Authorization: Bearer SECRET" \
 *     https://app.facilitaplus.com.br/api/cron/followup
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET nao configurado" },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await processarFollowupsPendentes();
  return NextResponse.json(result);
}

// GET opcional pra healthcheck (sem auth)
export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "/api/cron/followup" });
}
