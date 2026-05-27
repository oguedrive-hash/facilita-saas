import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Esconde o indicador "Rendering..." no canto inferior em modo dev
  devIndicators: false,
  // Build standalone — gera Dockerfile menor (só com runtime necessário)
  output: "standalone",
};

export default nextConfig;
