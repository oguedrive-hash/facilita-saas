import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Esconde o indicador "Rendering..." no canto inferior em modo dev
  devIndicators: false,
  // Build standalone — gera Dockerfile menor (só com runtime necessário)
  output: "standalone",
  // Permite upload de vídeos/imagens até 25MB em route handlers
  // (default do Next 16 é 10MB e corta o body, quebrando o parse do FormData)
  experimental: {
    proxyClientMaxBodySize: "100mb",
  },
  // Marca pacotes binários (ffmpeg-static) como externos pra Next nao tentar
  // bundlar — eles tem que ser resolvidos em runtime
  serverExternalPackages: [
    "@ffmpeg-installer/ffmpeg",
    "@ffprobe-installer/ffprobe",
    "fluent-ffmpeg",
  ],
};

export default nextConfig;
