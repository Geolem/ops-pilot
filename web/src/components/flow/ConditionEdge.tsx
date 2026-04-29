import { memo, useState } from "react";
import {
  Edge,
  EdgeProps,
  getStraightPath,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
} from "@xyflow/react";
import { CheckCircle2, GitBranch } from "lucide-react";

export interface ConditionEdgeData {
  [key: string]: unknown;
  condition?: string;
  onConditionChange?: (edgeId: string, condition: string) => void;
}

export type ConditionFlowEdge = Edge<ConditionEdgeData, "condition">;

function ConditionEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
}: EdgeProps<ConditionFlowEdge>) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(data?.condition ?? "");

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  });

  const hasCondition = !!(data?.condition?.trim());

  const save = () => {
    data?.onConditionChange?.(id, draft);
    setEditing(false);
  };

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan"
        >
          {editing ? (
            <div className="bg-bg-panel border border-brand/40 rounded-lg shadow-glow p-2 flex items-center gap-1.5 min-w-[240px]">
              <GitBranch className="w-3.5 h-3.5 text-brand shrink-0" />
              <input
                autoFocus
                className="input py-0.5 text-xs flex-1 font-mono"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false); }}
                placeholder="status === 200 或留空表示无条件"
              />
              <button className="btn-primary px-1.5 py-0.5 text-[11px]" onClick={save}>
                <CheckCircle2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => { setDraft(data?.condition ?? ""); setEditing(true); }}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] transition-all
                ${hasCondition
                  ? "bg-amber-500/20 text-amber-300 border border-amber-400/30 hover:bg-amber-500/30"
                  : "bg-bg-elevated/80 text-slate-500 border border-white/5 hover:text-slate-300 hover:border-white/10"
                }`}
            >
              <GitBranch className="w-3 h-3" />
              {hasCondition ? data!.condition : "添加条件"}
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}

export default memo(ConditionEdge);
