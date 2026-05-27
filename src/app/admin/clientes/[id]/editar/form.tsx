"use client";

import { useActionState } from "react";
import Link from "next/link";
import { editarClienteAction, type EditarClienteResult } from "./actions";

const initialState: EditarClienteResult = {};

type ClienteData = {
  id: string;
  name: string;
  email_contato: string;
  whatsapp_numero: string | null;
  plano: string;
  prompt_system: string | null;
  voice_id: string | null;
  ativo: boolean;
};

export function EditarClienteForm({ cliente }: { cliente: ClienteData }) {
  const [state, action, pending] = useActionState(
    editarClienteAction,
    initialState,
  );

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
              Voice ID (ElevenLabs)
            </label>
            <input
              id="voice_id"
              name="voice_id"
              type="text"
              defaultValue={cliente.voice_id ?? ""}
              placeholder="Ex: pNInz6obpgDQGcFmaJgB (Adam)"
              className="w-full px-4 py-3 rounded-lg border border-cinza-claro bg-white text-preto placeholder:text-cinza-medio focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition font-mono text-sm"
            />
            <p className="text-xs text-cinza-medio mt-1">
              Voice ID do ElevenLabs. Sugestões masculinas BR: Adam, Brian, ou
              voz personalizada da biblioteca.
            </p>
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
