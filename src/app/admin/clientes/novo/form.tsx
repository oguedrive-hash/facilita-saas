"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  cadastrarClienteAction,
  type CadastrarClienteResult,
} from "./actions";

const initialState: CadastrarClienteResult = {};

export function CadastrarClienteForm() {
  const [state, action, pending] = useActionState(
    cadastrarClienteAction,
    initialState,
  );

  return (
    <form action={action} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field
          name="name"
          label="Nome da empresa"
          placeholder="Ex: Acme Marketing"
          required
        />
        <Field
          name="email_contato"
          label="E-mail do contato"
          type="email"
          placeholder="dono@acme.com"
          required
          hint="Esse email vai logar no painel"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Field
          name="whatsapp_numero"
          label="WhatsApp do agente (chip)"
          placeholder="+5511999999999"
          hint="Número do chip que vai conectar na Evolution"
        />
        <div>
          <label
            htmlFor="plano"
            className="block text-sm font-heading font-semibold text-preto mb-1.5"
          >
            Plano <span className="text-laranja">*</span>
          </label>
          <select
            id="plano"
            name="plano"
            required
            defaultValue="mensal_basico"
            className="w-full px-4 py-3 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition"
          >
            <option value="mensal_basico">Básico</option>
            <option value="mensal_pro">Pro</option>
            <option value="mensal_enterprise">Enterprise</option>
          </select>
        </div>
      </div>

      {state.error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-800">{state.error}</p>
        </div>
      )}

      <div className="p-4 rounded-lg bg-laranja/5 border border-laranja/20">
        <p className="text-sm text-preto">
          <strong className="font-heading font-semibold">
            🚧 Provisionamento automático em construção:
          </strong>{" "}
          por enquanto só cria a organization no banco. Próximos passos vão
          provisionar conta Auth + Evolution + Chatwoot + Asaas automaticamente.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={pending}
          className="px-5 py-3 rounded-lg bg-laranja hover:bg-laranja-escuro disabled:bg-laranja-claro text-white font-heading font-semibold transition"
        >
          {pending ? "Cadastrando..." : "Cadastrar cliente"}
        </button>
        <Link
          href="/admin"
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
  placeholder,
  required = false,
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
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
        placeholder={placeholder}
        required={required}
        className="w-full px-4 py-3 rounded-lg border border-cinza-claro bg-white text-preto placeholder:text-cinza-medio focus:outline-none focus:ring-2 focus:ring-laranja focus:border-transparent transition"
      />
      {hint && (
        <p className="text-xs text-cinza-medio mt-1">{hint}</p>
      )}
    </div>
  );
}
