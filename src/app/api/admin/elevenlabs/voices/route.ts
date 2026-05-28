import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Apenas admin" }, { status: 403 });
  }

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "ELEVENLABS_API_KEY não configurada" },
      { status: 500 },
    );
  }

  const res = await fetch("https://api.elevenlabs.io/v1/voices", {
    headers: { "xi-api-key": key },
  });
  if (!res.ok) {
    return NextResponse.json(
      { error: `ElevenLabs ${res.status}` },
      { status: 502 },
    );
  }

  const body = (await res.json()) as {
    voices: Array<{
      voice_id: string;
      name: string;
      category?: string;
      labels?: Record<string, string>;
    }>;
  };

  const voices = body.voices.map((v) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category ?? "",
    labels: v.labels ?? {},
  }));

  return NextResponse.json({ voices });
}
