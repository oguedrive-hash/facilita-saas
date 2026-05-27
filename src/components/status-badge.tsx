import { STATUS_CONFIG, type StatusLead } from "@/lib/status-config";

export function StatusBadge({ status }: { status: StatusLead }) {
  const config = STATUS_CONFIG[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-heading font-semibold border ${config.bg} ${config.cor} ${config.border}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${config.cor.replace("text-", "bg-")}`}
      />
      {config.label}
    </span>
  );
}
