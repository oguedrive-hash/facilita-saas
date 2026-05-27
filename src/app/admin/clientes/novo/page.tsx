import Link from "next/link";
import { CadastrarClienteForm } from "./form";

export default function NovoClientePage() {
  return (
    <div className="max-w-3xl">
      <Link
        href="/admin"
        className="inline-flex items-center text-sm text-cinza-medio hover:text-laranja font-heading font-medium mb-4 transition"
      >
        ← Voltar pra Clientes
      </Link>

      <div className="mb-8">
        <h1 className="text-4xl font-heading font-bold text-preto">
          Novo cliente
        </h1>
        <p className="text-sm text-cinza-medio mt-1">
          Cadastra a empresa cliente que vai usar a Facilita Plus
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-cinza-claro p-8">
        <CadastrarClienteForm />
      </div>
    </div>
  );
}
