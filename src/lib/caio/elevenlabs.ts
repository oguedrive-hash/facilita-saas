/**
 * Cliente ElevenLabs minimalista — gera áudio a partir de texto.
 * Server-side only. Usa ELEVENLABS_API_KEY do .env.
 *
 * Voice settings espelham o padrão da Facilita (definido na tabela
 * organizations, mas hoje hardcoded até implementarmos multi-tenant de
 * verdade nas configs de voz).
 */

export type VoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  use_speaker_boost: boolean;
  speed: number;
};

export const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  stability: 0.25,
  similarity_boost: 0.9,
  style: 0.75,
  use_speaker_boost: true,
  speed: 1.15,
};

export type GerarAudioResult =
  | { audio: ArrayBuffer; mimeType: string }
  | { error: string };

export async function gerarAudio(opts: {
  texto: string;
  voiceId?: string;
  voiceSettings?: Partial<VoiceSettings> | null;
}): Promise<GerarAudioResult> {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return { error: "ELEVENLABS_API_KEY não definida" };

  const voiceId =
    opts.voiceId ?? process.env.ELEVENLABS_VOICE_ID ?? "";
  if (!voiceId) return { error: "voice_id não definida" };

  const settings: VoiceSettings = {
    ...DEFAULT_VOICE_SETTINGS,
    ...(opts.voiceSettings ?? {}),
  };

  try {
    // output_format=mp3_44100_64 reduz arquivo ~50% sem perda perceptível
    // de qualidade — Chatwoot/Evolution processam mais rápido.
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_64`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: opts.texto,
          model_id: "eleven_multilingual_v2",
          voice_settings: settings,
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      return {
        error: `ElevenLabs ${res.status}: ${text.slice(0, 300)}`,
      };
    }

    const audio = await res.arrayBuffer();
    return { audio, mimeType: "audio/mpeg" };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "fetch failed",
    };
  }
}
