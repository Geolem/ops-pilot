import { memo } from "react";
import { Handle, Position, NodeProps } from "reactflow";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import MethodBadge from "@/components/MethodBadge";
import { statusClass } from "@/lib/utils";
import { Endpoint } from "@/lib/api";

export interface EndpointNodeData {
  endpointId?: string;
  endpoint: Endpoint | null;
  alias?: string;
  status?: "idle" | "running" | "success" | "error";
  httpStatus?: number | null;
  durationMs?: number | null;
  onChange?: (patch: { endpointId?: string; alias?: string }) => void;
  endpoints: Endpoint[];
}

function EndpointNode({ data, selected }: NodeProps<EndpointNodeData>) {
  const ep = data.endpoint;
  const state = data.status ?? "idle";
  const ring =
    state === "running"
      ? "ring-2 ring-accent/60 shadow-[0_0_0_4px_rgba(34,211,238,0.12)]"
      : state === "success"
      ? "ring-1 ring-emerald-400/50"
      : state === "error"
      ? "ring-1 ring-rose-400/60"
      : selected
      ? "ring-1 ring-brand/60"
      : "ring-1 ring-white/5";

  return (
    <div
      className={`bg-bg-panel/90 backdrop-blur-md rounded-xl w-[260px] shadow-soft ${ring} transition-shadow`}
    >
      <Handle type="target" position={Position.Top} className="!bg-brand !w-2.5 !h-2.5" />
      <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
        {state === "running" && <Loader2 className="w-3.5 h-3.5 text-accent animate-spin" />}
        {state === "success" && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
        {state === "error" && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
        <span className="text-[11px] text-slate-400">步骤</span>
        {data.httpStatus != null && (
          <span className={`text-[11px] font-semibold ml-auto ${statusClass(data.httpStatus)}`}>
            {data.httpStatus || "ERR"}
            {data.durationMs != null && (
              <span className="text-slate-500 ml-1 font-normal">{data.durationMs}ms</span>
            )}
          </span>
        )}
      </div>
      <div className="p-3 space-y-2">
        <select
          className="input py-1.5 text-xs w-full nodrag"
          value={ep?.id ?? ""}
          onChange={(e) => data.onChange?.({ endpointId: e.target.value })}
        >
          <option value="">选择接口…</option>
          {data.endpoints.map((e) => (
            <option key={e.id} value={e.id}>
              [{e.method}] {e.name}
            </option>
          ))}
        </select>
        {ep && (
          <div className="flex items-center gap-1.5">
            <MethodBadge method={ep.method} />
            <span className="font-mono text-[11px] text-slate-400 truncate">{ep.path}</span>
          </div>
        )}
        <input
          className="input py-1.5 text-xs w-full nodrag"
          placeholder="别名（用于后续引用，如 login）"
          value={data.alias ?? ""}
          onChange={(e) => data.onChange?.({ alias: e.target.value })}
        />
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-accent !w-2.5 !h-2.5" />
    </div>
  );
}

export default memo(EndpointNode);
