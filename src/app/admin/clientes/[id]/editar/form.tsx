"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { editarClienteAction, type EditarClienteResult } from "./actions";

const initialState: EditarClienteResult = {};

type VoiceSettings = {
  stability?: number;
  similarity_boost?: number;
  style?: number;
  speed?: number;
  use_speaker_boost?: boolean;
};

type ClienteData = {
  id: string;
  name: string;
  email_contato: string;
  whatsapp_numero: string | null;
  plano: string;
  prompt_system: string | null;
  voice_id: string | null;
  voice_settings: VoiceSettings | null;
  ativo: boolean;
};

type VoiceOption = {
  voice_id: string;
  name: string;
  category: string;
};

const DEFAULTS = {
  stability: 0.25,
  similarity_boost: 0.9,
  style: 0.75,
  speed: 1.15,
  use_speaker_boost: true,
};

export function EditarClienteForm({ cliente }: { cliente: ClienteData }) {
  const [state, action, pending] = useActionState(
    editarClienteAction,
    initialState,
  );

  const vs = cliente.voice_settings ?? {};
  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [stability, setStability] = useState(vs.stability ?? DEFAULTS.stability);
  const [similarity, setSimilarity] = useState(
    vs.similarity_boost ?? DEFAULTS.similarity_boost,
  );
  const [style, setStyle] = useState(vs.style ?? DEFAULTS.style);
  const [speed, setSpeed] = useState(vs.speed ?? DEFAULTS.speed);

  useEffect(() => {
    fetch("/api/admin/elevenlabs/voices")
      .then((r) => r.json())
      .then((data) => {
        if (data.voices) setVoices(data.voices);
        else setVoicesError(data.error ?? "erro desconhecido");
      })
      .catch((e) => setVoicesError(e.message));
  }, []);

  return (
    <form action={action} className="space-y-8">
      <input type="hidden" name="id" value={cliente.id} />

      {/* Seção 1: dados básicos */}
      <section>
        <h3 className="text-base font-heading font-bold text-preto mb-4">
          Dados básicos
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field
            name="name"
            label="Nome da empresa"
            defaultValue={cliente.name}
            required
          />
          <Field
            name="email_contato"
            label="E-mail de contato"
            type="email"
            defaultValue={cliente.email_contato}
            required
          />
          <Field
            name="whatsapp_numero"
            label="WhatsApp do agente (chip)"
            defaultValue={cliente.whatsapp_numero ?? ""}
            placeholder="+5511999999999"
          />
          <div>
            <label
              htmlFor="plano"
              className="block text-sm font-heading font-semibold text-preto mb-1.5"
            >
              Plano
            </label>
            <select
              id="plano"
              name="plano"
              defaultValue={cliente.plano}
              className="w-full px-4 py-3 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition"
            >
              <option value="mensal_basico">Básico</option>
              <option value="mensal_pro">Pro</option>
              <option value="mensal_enterprise">Enterprise</option>
            </select>
          </div>
        </div>
      </section>

      {/* Seção 2: configuração do agente */}
      <section>
        <h3 className="text-base font-heading font-bold text-preto mb-4">
          Configuração do Caio (agente IA)
        </h3>

        <div className="space-y-5">
          <div>
            <label
              htmlFor="voice_id"
              className="block text-sm font-heading font-semibold text-preto mb-1.5"
            >
              Voz (ElevenLabs)
            </label>
            {voices.length > 0 ? (
              <select
                id="voice_id"
                name="voice_id"
                defaultValue={cliente.voice_id ?? ""}
                className="w-full px-4 py-3 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition"
              >
                <option value="">— Selecione uma voz —</option>
                {voices.map((v) => (
                  <option key={v.voice_id} value={v.voice_id}>
                    {v.name}
                    {v.category ? ` (${v.category})` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id="voice_id"
                name="voice_id"
                type="text"
                defaultValue={cliente.voice_id ?? ""}
                placeholder="Ex: pNInz6obpgDQGcFmaJgB"
                className="w-full px-4 py-3 rounded-lg border border-cinza-claro bg-white text-preto placeholder:text-cinza-medio focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition font-mono text-sm"
              />
            )}
            <p className="text-xs text-cinza-medio mt-1">
              {voicesError
                ? `Falha ao carregar vozes da ElevenLabs (${voicesError}). Coloque o ID manualmente.`
                : voices.length === 0
                  ? "Carregando vozes da sua conta ElevenLabs..."
                  : `${voices.length} vozes disponíveis na sua conta ElevenLabs.`}
            </p>
          </div>

          {/* Sliders de voice_settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 p-4 rounded-lg bg-offwhite border border-cinza-claro">
            <Slider
              name="voice_stability"
              label="Stability"
              hint="Baixo = mais expressivo, alto = mais consistente"
              value={stability}
              setValue={setStability}
              min={0}
              max={1}
              step={0.05}
            />
            <Slider
              name="voice_similarity_boost"
              label="Similarity boost"
              hint="Quão fiel ao timbre original da voz"
              value={similarity}
              setValue={setSimilarity}
              min={0}
              max={1}
              step={0.05}
            />
            <Slider
              name="voice_style"
              label="Style"
              hint="0 = neutro, 1 = exagera o estilo da voz"
              value={style}
              setValue={setStyle}
              min={0}
              max={1}
              step={0.05}
            />
            <Slider
              name="voice_speed"
              label="Speed"
              hint="0.7 = mais lento, 1.2 = mais rápido"
              value={speed}
              setValue={setSpeed}
              min={0.7}
              max={1.2}
              step={0.05}
            />
            <label className="flex items-center gap-3 md:col-span-2">
              <input
                type="checkbox"
                name="voice_use_speaker_boost"
                defaultChecked={
                  vs.use_speaker_boost ?? DEFAULTS.use_speaker_boost
                }
                className="w-4 h-4 rounded text-laranja focus:ring-laranja"
              />
              <span className="text-sm font-heading font-semibold text-preto">
                Speaker boost
              </span>
              <span className="text-xs text-cinza-medio">
                Aumenta similaridade com o speaker (recomendado ligado)
              </span>
            </label>
          </div>

          <div>
            <label
              htmlFor="prompt_system"
              className="block text-sm font-heading font-semibold text-preto mb-1.5"
            >
              System Prompt do Caio
            </label>
            <textarea
              id="prompt_system"
              name="prompt_system"
              rows={12}
              defaultValue={cliente.prompt_system ?? ""}
              placeholder="Você é o Caio, atendente IA da [Empresa]..."
              className="w-full px-4 py-3 rounded-lg border border-cinza-claro bg-white text-preto placeholder:text-cinza-medio focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition font-mono text-xs leading-relaxed"
            />
            <p className="text-xs text-cinza-medio mt-1">
              Prompt completo do agente. Inclui identidade, tom de voz, regras,
              frases TINTIN, etc.
            </p>
          </div>
        </div>
      </section>

      {/* Seção 3: status */}
      <section>
        <h3 className="text-base font-heading font-bold text-preto mb-4">
          Status
        </h3>

        <label className="flex items-center gap-3 p-4 rounded-lg bg-offwhite border border-cinza-claro cursor-pointer hover:border-laranja transition">
          <input
            type="checkbox"
            name="ativo"
            defaultChecked={cliente.ativo}
            className="w-4 h-4 rounded text-laranja focus:ring-laranja"
          />
          <div>
            <p className="text-sm font-heading font-semibold text-preto">
              Cliente ativo
            </p>
            <p className="text-xs text-cinza-medio">
              Quando desmarcado, o Caio é pausado pra esse cliente
            </p>
          </div>
        </label>
      </section>

      {state.error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-800">{state.error}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2 border-t border-cinza-claro">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-3 rounded-lg bg-laranja hover:bg-laranja-escuro disabled:bg-laranja-claro text-white font-heading font-semibold transition"
        >
          {pending ? "Salvando..." : "Salvar alterações"}
        </button>
        <Link
          href={`/admin/clientes/${cliente.id}`}
          className="px-5 py-3 rounded-lg text-cinza-medio hover:text-preto font-heading font-medium transition"
        >
          Cancelar
        </Link>
      </div>
    </form>
  );
}

function Slider({
  name,
  label,
  hint,
  value,
  setValue,
  min,
  max,
  step,
}: {
  name: string;
  label: string;
  hint: string;
  value: number;
  setValue: (n: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label
          htmlFor={name}
          className="text-sm font-heading font-semibold text-preto"
        >
          {label}
        </label>
        <span className="text-sm font-mono text-laranja">
          {value.toFixed(2)}
        </span>
      </div>
      <input
        id={name}
        name={name}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full accent-laranja"
      />
      <p className="text-xs text-cinza-medio mt-1">{hint}</p>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue = "",
  placeholder,
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={name}
        className="block text-sm font-heading font-semibold text-preto mb-1.5"
      >
        {label} {required && <span className="text-laranja">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-3 rounded-lg border border-cinza-claro bg-white text-preto placeholder:text-cinza-medio focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition"
      />
    </div>
  );
}
