import { NextResponse, type NextRequest } from "next/server";
import { processarRetomadasPendentes } from "@/lib/caio/retomadas";

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
  const result = await processarRetomadasPendentes();
  return NextResponse.json(result);
}

export async function GET() {
  return NextResponse.json({ status: "ok", endpoint: "/api/cron/retomadas" });
}
