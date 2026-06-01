import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TIPOS_PERMITIDOS = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "video/mp4",
  "video/webm",
];

const TAMANHO_MAX_MB = 20;

export async function POST(request: NextRequest) {
  // Valida admin
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

  // Le formData
  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "arquivo ausente" }, { status: 400 });
  }
  if (!TIPOS_PERMITIDOS.includes(file.type)) {
    return NextResponse.json(
      { error: `Tipo nao permitido: ${file.type}` },
      { status: 400 },
    );
  }
  if (file.size > TAMANHO_MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `Arquivo grande demais (max ${TAMANHO_MAX_MB}MB)` },
      { status: 400 },
    );
  }

  // Upload via service_role (bypass RLS)
  const admin = createAdminClient();
  const ext = file.name.split(".").pop() ?? "bin";
  const nomeArquivo = `${crypto.randomUUID()}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from("followup-anexos")
    .upload(nomeArquivo, file, {
      contentType: file.type,
      cacheControl: "31536000",
      upsert: false,
    });

  if (uploadErr) {
    return NextResponse.json(
      { error: `Upload falhou: ${uploadErr.message}` },
      { status: 500 },
    );
  }

  const { data: urlData } = admin.storage
    .from("followup-anexos")
    .getPublicUrl(nomeArquivo);

  return NextResponse.json({
    url: urlData.publicUrl,
    mime: file.type,
    nome: file.name,
  });
}
