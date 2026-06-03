"use client";

import { useRef, useState, useTransition } from "react";
import {
  criarLeadProspeccaoAvulso,
  importarLeadsProspeccao,
  type LeadImport,
  type RelatorioImportacao,
} from "./actions";

const CSV_TEMPLATE =
  "nome,telefone,empresa,segmento\nJoão Silva,5511999998888,Acme Co,SaaS\nMaria Souza,(11) 98888-7777,Beta Ltda,Varejo\n";

/**
 * Parser CSV simples: split por linha, split por virgula. Trim em cada
 * celula. NAO suporta aspas escapadas — adequado pra planilhas exportadas
 * do Excel/Sheets com colunas sem virgulas internas.
 */
function parseCsv(texto: string): { headers: string[]; linhas: string[][] } {
  const linhasRaw = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (linhasRaw.length === 0) return { headers: [], linhas: [] };
  const headers = linhasRaw[0].split(",").map((c) => c.trim().toLowerCase());
  const linhas = linhasRaw.slice(1).map((l) => l.split(",").map((c) => c.trim()));
  return { headers, linhas };
}

function csvParaLeads(headers: string[], linhas: string[][]): LeadImport[] {
  const idxNome = headers.indexOf("nome");
  const idxTelefone = headers.indexOf("telefone");
  return linhas.map((cells) => {
    const dados_extras: Record<string, string> = {};
    headers.forEach((h, i) => {
      if (h !== "nome" && h !== "telefone" && cells[i]) {
        dados_extras[h] = cells[i];
      }
    });
    return {
      nome: idxNome >= 0 ? (cells[idxNome] ?? "") : "",
      telefone: idxTelefone >= 0 ? (cells[idxTelefone] ?? "") : "",
      dados_extras,
    };
  });
}

function baixarTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "leads-prospeccao-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ImportarForm({
  organizationId,
  temCadenciaAtiva,
}: {
  organizationId: string;
  temCadenciaAtiva: boolean;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewLeads, setPreviewLeads] = useState<LeadImport[]>([]);
  const [previewErro, setPreviewErro] = useState<string | null>(null);
  const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null);
  const [pending, startTransition] = useTransition();

  // Avulso form
  const [nomeAvulso, setNomeAvulso] = useState("");
  const [telefoneAvulso, setTelefoneAvulso] = useState("");
  const [extrasAvulso, setExtrasAvulso] = useState("");
  const [erroAvulso, setErroAvulso] = useState<string | null>(null);
  const [sucessoAvulso, setSucessoAvulso] = useState(false);

  function handleArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewErro(null);
    setRelatorio(null);
    const reader = new FileReader();
    reader.onload = () => {
      const txt = reader.result as string;
      const { headers, linhas } = parseCsv(txt);
      if (!headers.includes("nome") || !headers.includes("telefone")) {
        setPreviewErro(
          "CSV precisa ter colunas 'nome' e 'telefone' (primeira linha).",
        );
        setPreviewLeads([]);
        return;
      }
      const leads = csvParaLeads(headers, linhas);
      setPreviewLeads(leads);
    };
    reader.readAsText(file);
  }

  function confirmarImportacao() {
    if (previewLeads.length === 0) return;
    setRelatorio(null);
    startTransition(async () => {
      const result = await importarLeadsProspeccao(
        organizationId,
        previewLeads,
      );
      if ("error" in result) {
        setPreviewErro(result.error);
      } else {
        setRelatorio(result.relatorio);
        setPreviewLeads([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  }

  function salvarAvulso() {
    setErroAvulso(null);
    setSucessoAvulso(false);
    if (!nomeAvulso.trim() || !telefoneAvulso.trim()) {
      setErroAvulso("Nome e telefone são obrigatórios");
      return;
    }
    // Parse "chave=valor;chave2=valor2" ou JSON
    let extras: Record<string, string> = {};
    if (extrasAvulso.trim()) {
      try {
        if (extrasAvulso.trim().startsWith("{")) {
          extras = JSON.parse(extrasAvulso);
        } else {
          extrasAvulso.split(/[;\n]/).forEach((par) => {
            const [k, ...rest] = par.split("=");
            if (k && rest.length > 0) {
              extras[k.trim().toLowerCase()] = rest.join("=").trim();
            }
          });
        }
      } catch {
        setErroAvulso("Dados extras em formato inválido");
        return;
      }
    }
    startTransition(async () => {
      const result = await criarLeadProspeccaoAvulso(organizationId, {
        nome: nomeAvulso,
        telefone: telefoneAvulso,
        dados_extras: extras,
      });
      if ("error" in result) {
        setErroAvulso(result.error);
      } else {
        setSucessoAvulso(true);
        setNomeAvulso("");
        setTelefoneAvulso("");
        setExtrasAvulso("");
        setTimeout(() => setSucessoAvulso(false), 3000);
      }
    });
  }

  return (
    <div className="space-y-8">
      {!temCadenciaAtiva && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-900">
            ⚠ Você não tem cadência configurada na aba <strong>Cadência</strong>.
            Leads importados ficarão na fila sem mensagem agendada até você
            criar pelo menos uma regra.
          </p>
        </div>
      )}

      {/* Seção 1: Upload CSV */}
      <section>
        <h3 className="text-base font-heading font-bold text-preto mb-2">
          Importar via CSV
        </h3>
        <p className="text-xs text-cinza-medio mb-3">
          Colunas obrigatórias: <code>nome</code>, <code>telefone</code>.
          Qualquer outra coluna vira placeholder usável nas mensagens (ex:{" "}
          <code>{"{empresa}"}</code>).
        </p>

        <button
          type="button"
          onClick={baixarTemplate}
          className="text-sm text-laranja hover:underline font-heading font-semibold mb-3"
        >
          ↓ Baixar template CSV
        </button>

        <label className="block">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleArquivo}
            className="block w-full text-xs text-cinza-medio file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border file:border-cinza-claro file:bg-white file:text-preto file:font-heading file:font-semibold file:text-xs hover:file:border-laranja cursor-pointer"
          />
        </label>

        {previewErro && (
          <p className="text-xs text-red-700 mt-2">{previewErro}</p>
        )}

        {previewLeads.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-heading font-semibold text-preto">
                Prévia ({previewLeads.length} linhas)
              </p>
              <button
                type="button"
                onClick={confirmarImportacao}
                disabled={pending}
                className="px-4 py-2 rounded-lg bg-laranja hover:bg-laranja-escuro disabled:bg-laranja-claro text-white font-heading font-semibold text-sm transition"
              >
                {pending ? "Importando..." : "Confirmar importação"}
              </button>
            </div>
            <div className="max-h-64 overflow-auto border border-cinza-claro rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-offwhite sticky top-0">
                  <tr>
                    <th className="text-left p-2 font-heading">Nome</th>
                    <th className="text-left p-2 font-heading">Telefone</th>
                    <th className="text-left p-2 font-heading">Extras</th>
                  </tr>
                </thead>
                <tbody>
                  {previewLeads.slice(0, 50).map((l, i) => (
                    <tr key={i} className="border-t border-cinza-claro">
                      <td className="p-2">{l.nome}</td>
                      <td className="p-2 font-mono">{l.telefone}</td>
                      <td className="p-2 text-cinza-medio">
                        {Object.entries(l.dados_extras)
                          .map(([k, v]) => `${k}=${v}`)
                          .join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {previewLeads.length > 50 && (
                <p className="p-2 text-[10px] text-cinza-medio text-center">
                  ...e mais {previewLeads.length - 50} linhas
                </p>
              )}
            </div>
          </div>
        )}

        {relatorio && (
          <div className="mt-4 p-4 rounded-lg bg-offwhite border border-cinza-claro">
            <p className="text-sm font-heading font-semibold text-preto mb-2">
              Resultado da importação
            </p>
            <ul className="text-xs space-y-1">
              <li className="text-emerald-700">
                ✓ Importados: <strong>{relatorio.importados}</strong>
              </li>
              {relatorio.reativados > 0 && (
                <li className="text-blue-700">
                  ↻ Reativados (estavam em perdido/fechou):{" "}
                  <strong>{relatorio.reativados}</strong>
                </li>
              )}
              {relatorio.pulados > 0 && (
                <li className="text-amber-700">
                  ⚠ Pulados (já ativos em outro fluxo):{" "}
                  <strong>{relatorio.pulados}</strong>
                </li>
              )}
              {relatorio.invalidos > 0 && (
                <li className="text-red-700">
                  ✕ Inválidos: <strong>{relatorio.invalidos}</strong>
                </li>
              )}
            </ul>
            {relatorio.erros.length > 0 && (
              <details className="mt-2">
                <summary className="text-xs cursor-pointer text-cinza-medio">
                  Ver detalhes ({relatorio.erros.length})
                </summary>
                <ul className="text-[10px] mt-1 space-y-0.5 max-h-32 overflow-auto">
                  {relatorio.erros.map((e, i) => (
                    <li key={i} className="text-cinza-medio">
                      linha {e.linha}: {e.motivo}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </section>

      {/* Seção 2: Form manual */}
      <section className="pt-6 border-t border-cinza-claro">
        <h3 className="text-base font-heading font-bold text-preto mb-2">
          Adicionar lead avulso
        </h3>
        <p className="text-xs text-cinza-medio mb-3">
          Use pra cadastrar um lead solto sem ter que montar planilha.
        </p>

        <div className="space-y-3 p-4 rounded-lg bg-offwhite border border-cinza-claro">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1">
                Nome *
              </label>
              <input
                type="text"
                value={nomeAvulso}
                onChange={(e) => setNomeAvulso(e.target.value)}
                placeholder="João Silva"
                className="w-full px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:border-laranja transition text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1">
                Telefone (com DDD) *
              </label>
              <input
                type="text"
                value={telefoneAvulso}
                onChange={(e) => setTelefoneAvulso(e.target.value)}
                placeholder="11999998888"
                className="w-full px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:border-laranja transition text-sm font-mono"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-heading font-semibold text-cinza-medio uppercase tracking-wider mb-1">
              Dados extras (opcional)
            </label>
            <textarea
              rows={2}
              value={extrasAvulso}
              onChange={(e) => setExtrasAvulso(e.target.value)}
              placeholder="empresa=Acme Co; segmento=SaaS"
              className="w-full px-3 py-2 rounded-lg border border-cinza-claro bg-white text-preto focus:outline-none focus:border-laranja transition text-sm font-mono"
            />
            <p className="text-[10px] text-cinza-medio mt-1">
              Formato: <code>chave=valor; chave2=valor2</code>. Viram
              placeholders {"{chave}"} usáveis nas mensagens.
            </p>
          </div>

          {erroAvulso && (
            <p className="text-xs text-red-700">{erroAvulso}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={salvarAvulso}
              disabled={pending}
              className="px-4 py-2 rounded-lg bg-laranja hover:bg-laranja-escuro disabled:bg-laranja-claro text-white font-heading font-semibold text-sm transition"
            >
              {pending ? "Salvando..." : "Adicionar lead"}
            </button>
            {sucessoAvulso && (
              <span className="text-xs text-green-700 font-heading font-semibold">
                ✓ Lead criado
              </span>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
