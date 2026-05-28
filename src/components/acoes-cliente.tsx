"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  pausarReativarCliente,
  deletarCliente,
} from "@/app/admin/clientes/[id]/acoes-actions";

export function AcoesCliente({
  clienteId,
  nomeCliente,
  ativoInicial,
}: {
  clienteId: string;
  nomeCliente: string;
  ativoInicial: boolean;
}) {
  const router = useRouter();
  const [ativo, setAtivo] = useState(ativoInicial);
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [confirmacaoDelete, setConfirmacaoDelete] = useState("");
  const [modalDelete, setModalDelete] = useState(false);

  function togglePausar() {
    setErro(null);
    const novoAtivo = !ativo;
    setAtivo(novoAtivo); // optimistic
    startTransition(async () => {
      const fd = new FormData();
      fd.set("clienteId", clienteId);
      fd.set("ativo", novoAtivo ? "true" : "false");
      const result = await pausarReativarCliente(fd);
      if ("error" in result) {
        setErro(result.error);
        setAtivo(!novoAtivo);
      }
    });
  }

  function deletar() {
    if (confirmacaoDelete !== nomeCliente) {
      setErro("Digite o nome exato do cliente pra confirmar");
      return;
    }
    setErro(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("clienteId", clienteId);
      const result = await deletarCliente(fd);
      if ("error" in result) {
        setErro(result.error);
      } else {
        router.push("/admin");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Pausar / Reativar */}
      <div className="p-5 bg-white rounded-2xl border border-cinza-claro">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-heading font-bold text-preto">
              {ativo ? "Pausar cliente" : "Reativar cliente"}
            </h3>
            <p className="text-xs text-cinza-medio mt-1">
              {ativo
                ? "Caio para de responder em todos os leads desse cliente. Não deleta dados."
                : "Caio volta a responder em todos os leads desse cliente."}
            </p>
          </div>
          <button
            type="button"
            onClick={togglePausar}
            disabled={pending}
            className={`px-4 py-2 rounded-lg font-heading font-semibold text-sm transition disabled:opacity-60 ${
              ativo
                ? "bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-200"
                : "bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border border-emerald-200"
            }`}
          >
            {pending ? "..." : ativo ? "Pausar" : "Reativar"}
          </button>
        </div>
      </div>

      {/* Deletar (zona de perigo) */}
      <div className="p-5 bg-red-50 rounded-2xl border border-red-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-heading font-bold text-red-800">
              Deletar cliente
            </h3>
            <p className="text-xs text-red-700 mt-1">
              Apaga permanentemente o cliente, todos os leads, mensagens,
              agendamentos e configurações. Esta ação NÃO pode ser desfeita.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalDelete(true)}
            disabled={pending}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-heading font-semibold text-sm transition"
          >
            Deletar
          </button>
        </div>
      </div>

      {erro && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200">
          <p className="text-sm text-red-800">{erro}</p>
        </div>
      )}

      {/* Modal de confirmação */}
      {modalDelete && (
        <div className="fixed inset-0 bg-preto/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <h3 className="text-lg font-heading font-bold text-preto mb-2">
              Confirmar exclusão
            </h3>
            <p className="text-sm text-cinza-medio mb-4">
              Pra confirmar, digite{" "}
              <span className="font-mono font-semibold text-preto">
                {nomeCliente}
              </span>{" "}
              abaixo:
            </p>
            <input
              type="text"
              value={confirmacaoDelete}
              onChange={(e) => setConfirmacaoDelete(e.target.value)}
              placeholder="Digite o nome do cliente"
              className="w-full px-3 py-2 rounded-lg border border-cinza-claro text-sm text-preto focus:outline-none focus:border-laranja mb-4"
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setModalDelete(false);
                  setConfirmacaoDelete("");
                  setErro(null);
                }}
                disabled={pending}
                className="px-4 py-2 rounded-lg bg-white border border-cinza-claro hover:border-cinza-medio text-preto text-sm font-heading font-semibold transition"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={deletar}
                disabled={pending || confirmacaoDelete !== nomeCliente}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-heading font-semibold transition"
              >
                {pending ? "Deletando..." : "Deletar permanentemente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
