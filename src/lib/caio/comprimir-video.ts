/**
 * Compressao de video com ffmpeg.
 * Usado pra encolher videos > 16MB pra caber no limite do WhatsApp/Evolution.
 *
 * Estrategia: alvo de 14MB (margem do limite 16MB do WhatsApp).
 * Bitrate = (14MB * 8) / duracao_seg. Resolucao max 720p, audio 64kbps.
 */

import { promises as fs } from "fs";
import path from "path";
import os from "os";
import { randomUUID } from "crypto";
import ffmpeg from "fluent-ffmpeg";

// ffmpeg+ffprobe do PATH do sistema (instalado via apk no Dockerfile, ou via
// pacotes npm em dev local). Tenta pacote npm primeiro, fallback PATH.
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffmpegInst = require("@ffmpeg-installer/ffmpeg");
  if (ffmpegInst?.path) ffmpeg.setFfmpegPath(ffmpegInst.path);
} catch {
  // ffmpeg do PATH sera usado
}
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ffprobeInst = require("@ffprobe-installer/ffprobe");
  if (ffprobeInst?.path) ffmpeg.setFfprobePath(ffprobeInst.path);
} catch {
  // ffprobe do PATH sera usado
}

const ALVO_BYTES = 14 * 1024 * 1024; // 14MB

export async function comprimirVideoSeNecessario(opts: {
  buffer: Uint8Array;
  mimeType: string;
}): Promise<{ buffer: Uint8Array; mimeType: string; comprimiu: boolean }> {
  // So mexe em video. Imagens nao comprimimos.
  if (!opts.mimeType.startsWith("video/")) {
    return {
      buffer: opts.buffer,
      mimeType: opts.mimeType,
      comprimiu: false,
    };
  }
  if (opts.buffer.length <= ALVO_BYTES) {
    return {
      buffer: opts.buffer,
      mimeType: opts.mimeType,
      comprimiu: false,
    };
  }

  const tmpDir = os.tmpdir();
  const ext = opts.mimeType === "video/webm" ? "webm" : "mp4";
  const inputPath = path.join(tmpDir, `in-${randomUUID()}.${ext}`);
  const outputPath = path.join(tmpDir, `out-${randomUUID()}.mp4`);

  try {
    await fs.writeFile(inputPath, opts.buffer);

    // Pega duracao
    const duracao = await new Promise<number>((resolve, reject) => {
      ffmpeg.ffprobe(inputPath, (err, data) => {
        if (err) return reject(err);
        const dur = data.format.duration ?? 0;
        if (dur <= 0) return reject(new Error("duracao invalida"));
        resolve(dur);
      });
    });

    // Calcula bitrate alvo em kbps. Reserva 64kbps pro audio.
    const bitrateTotalKbps = Math.floor((ALVO_BYTES * 8) / 1024 / duracao);
    const bitrateAudioKbps = 64;
    const bitrateVideoKbps = Math.max(150, bitrateTotalKbps - bitrateAudioKbps);

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .videoCodec("libx264")
        .audioCodec("aac")
        .videoBitrate(`${bitrateVideoKbps}k`)
        .audioBitrate(`${bitrateAudioKbps}k`)
        .outputOptions([
          // Resolucao max 720p, mantem proporcao
          "-vf",
          "scale='min(1280,iw)':'min(720,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
          // Preset rapido pra nao demorar mais que necessario
          "-preset",
          "veryfast",
          "-movflags",
          "+faststart",
        ])
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .save(outputPath);
    });

    const comprimido = await fs.readFile(outputPath);
    return {
      buffer: comprimido,
      mimeType: "video/mp4",
      comprimiu: true,
    };
  } finally {
    // Limpa /tmp mesmo se der erro
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(outputPath).catch(() => {});
  }
}
