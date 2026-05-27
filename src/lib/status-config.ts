/**
 * Configuração centralizada de status de leads.
 * Cores e labels usados em toda a UI.
 */

export type StatusLead =
  | "novo_lead"
  | "em_conversa"
  | "followup"
  | "contatar_futuramente"
  | "perdido"
  | "reuniao_agendada"
  | "fechou";

export const STATUS_CONFIG: Record<
  StatusLead,
  {
    label: string;
    descricao: string;
    cor: string;
    bg: string;
    border: string;
    ordem: number;
  }
> = {
  novo_lead: {
    label: "Novo Lead",
    descricao: "Lead chegou, ainda não respondeu",
    cor: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
    ordem: 1,
  },
  em_conversa: {
    label: "Em conversa",
    descricao: "Caio conversando com o lead",
    cor: "text-laranja",
    bg: "bg-laranja/10",
    border: "border-laranja/30",
    ordem: 2,
  },
  followup: {
    label: "Follow-up",
    descricao: "Caio fazendo follow-ups",
    cor: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
    ordem: 3,
  },
  contatar_futuramente: {
    label: "Contatar futuro",
    descricao: "Lead com data específica pra contato",
    cor: "text-purple-700",
    bg: "bg-purple-50",
    border: "border-purple-200",
    ordem: 4,
  },
  reuniao_agendada: {
    label: "Reunião agendada",
    descricao: "Aguardando consultoria",
    cor: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
    ordem: 5,
  },
  fechou: {
    label: "Fechou",
    descricao: "Cliente fechou projeto",
    cor: "text-emerald-800",
    bg: "bg-emerald-100",
    border: "border-emerald-300",
    ordem: 6,
  },
  perdido: {
    label: "Perdido",
    descricao: "Lead não converteu",
    cor: "text-cinza-medio",
    bg: "bg-cinza-claro",
    border: "border-cinza-claro",
    ordem: 7,
  },
};

export const STATUS_ORDEM: StatusLead[] = [
  "novo_lead",
  "em_conversa",
  "followup",
  "contatar_futuramente",
  "reuniao_agendada",
  "fechou",
  "perdido",
];
