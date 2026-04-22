import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Play,
  Save,
  Trash2,
  ArrowDown,
  Workflow,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { api, Endpoint, Flow } from "@/lib/api";
import { useAppStore } from "@/store/app";
import Empty from "@/components/Empty";
import Modal from "@/components/Modal";
import MethodBadge from "@/components/MethodBadge";
import JsonEditor from "@/components/JsonEditor";
import { statusClass, stringifyPretty } from "@/lib/utils";

interface FlowNode {
  id: string;
  endpointId: string;
  alias?: string;
}

export default function FlowsPage() {
  const qc = useQueryClient();
  const { activeProjectId, activeEnvironmentId } = useAppStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: flows = [] } = useQuery({
    queryKey: ["flows", activeProjectId],
    queryFn: () =>
      activeProjectId
        ? api.get<Flow[]>(`/api/flows?projectId=${activeProjectId}`)
        : Promise.resolve([]),
    enabled: !!activeProjectId,
  });

  const { data: endpoints = [] } = useQuery({
    queryKey: ["endpoints", activeProjectId],
    queryFn: () =>
      activeProjectId
        ? api.get<Endpoint[]>(`/api/endpoints?projectId=${activeProjectId}`)
        : Promise.resolve([]),
    enabled: !!activeProjectId,
  });

  const selected = flows.find((f) => f.id === selectedId) ?? flows[0];

  const createFlow = useMutation({
    mutationFn: (name: string) =>
      api.post<Flow>("/api/flows", { projectId: activeProjectId, name, nodes: "[]" }),
    onSuccess: (flow) => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      setSelectedId(flow.id);
      setNameOpen(false);
      setNewName("");
    },
  });

  if (!activeProjectId) {
    return (
      <div className="p-8">
        <Empty title="请先在顶部选择一个项目" hint="编排关联到项目。" />
      </div>
    );
  }

  return (
    <div className="h-full grid grid-cols-[280px_1fr]">
      <div className="border-r border-white/5 bg-bg-panel/30 flex flex-col">
        <div className="p-3 border-b border-white/5 flex items-center gap-2">
          <div className="text-sm text-slate-300 flex items-center gap-1.5 flex-1">
            <Workflow className="w-4 h-4" />
            编排列表
          </div>
          <button className="btn-primary px-2" onClick={() => setNameOpen(true)}>
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2">
          {flows.length === 0 && <Empty title="还没有编排" />}
          {flows.map((f) => (
            <button
              key={f.id}
              onClick={() => setSelectedId(f.id)}
              className={`w-full text-left px-3 py-2 rounded-md my-0.5 transition-colors ${
                selected?.id === f.id ? "bg-brand/15 ring-1 ring-brand/30" : "hover:bg-bg-hover/50"
              }`}
            >
              <div className="text-sm text-white truncate">{f.name}</div>
              {f.description && (
                <div className="text-[11px] text-slate-500 truncate">{f.description}</div>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-auto">
        {selected ? (
          <FlowEditor
            key={selected.id}
            flow={selected}
            endpoints={endpoints}
            environmentId={activeEnvironmentId}
          />
        ) : (
          <Empty title="选择或新建一个编排" />
        )}
      </div>

      <Modal open={nameOpen} onClose={() => setNameOpen(false)} title="新建编排">
        <div className="space-y-3">
          <input
            className="input"
            placeholder="编排名称，如 清理用户订阅异常"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setNameOpen(false)}>取消</button>
            <button
              className="btn-primary"
              disabled={!newName}
              onClick={() => createFlow.mutate(newName)}
            >
              <Save className="w-4 h-4" /> 创建
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function FlowEditor({
  flow,
  endpoints,
  environmentId,
}: {
  flow: Flow;
  endpoints: Endpoint[];
  environmentId: string | null;
}) {
  const qc = useQueryClient();
  const [nodes, setNodes] = useState<FlowNode[]>(() => {
    try {
      return JSON.parse(flow.nodes) as FlowNode[];
    } catch {
      return [];
    }
  });
  const [name, setName] = useState(flow.name);
  const [description, setDescription] = useState(flow.description ?? "");
  const [runResult, setRunResult] = useState<any>(null);

  useEffect(() => {
    try {
      setNodes(JSON.parse(flow.nodes));
    } catch {
      setNodes([]);
    }
    setName(flow.name);
    setDescription(flow.description ?? "");
    setRunResult(null);
  }, [flow.id]);

  const save = useMutation({
    mutationFn: () =>
      api.patch<Flow>(`/api/flows/${flow.id}`, {
        name,
        description,
        nodes: JSON.stringify(nodes),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      toast.success("编排已保存");
    },
  });

  const del = useMutation({
    mutationFn: () => api.del(`/api/flows/${flow.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["flows"] });
      toast.success("已删除");
    },
  });

  const run = useMutation({
    mutationFn: () =>
      api.post("/api/flows/run", {
        environmentId: environmentId ?? undefined,
        nodes,
      }),
    onSuccess: (r) => setRunResult(r),
  });

  const addNode = () => {
    if (!endpoints[0]) {
      toast.error("先去「接口」创建至少一个接口");
      return;
    }
    setNodes([
      ...nodes,
      { id: Math.random().toString(36).slice(2, 9), endpointId: endpoints[0].id },
    ]);
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex-1 space-y-2">
          <input
            className="input text-base font-medium"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="描述（可选）"
          />
        </div>
        <div className="flex gap-1">
          <button className="btn-ghost" onClick={() => save.mutate()}>
            <Save className="w-3.5 h-3.5" /> 保存
          </button>
          <button
            className="btn-primary"
            onClick={() => run.mutate()}
            disabled={run.isPending || nodes.length === 0 || !environmentId}
            title={environmentId ? "" : "请先在顶部选择环境"}
          >
            <Play className="w-3.5 h-3.5" />
            {run.isPending ? "执行中…" : "运行"}
          </button>
          <button
            className="btn-danger"
            onClick={() => confirm(`删除编排 ${flow.name}？`) && del.mutate()}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {nodes.map((n, i) => (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="card p-3"
            >
              <div className="flex items-center gap-2">
                <span className="chip bg-white/5 text-slate-400">#{i + 1}</span>
                <select
                  className="input py-1.5 flex-1"
                  value={n.endpointId}
                  onChange={(e) => {
                    const next = nodes.slice();
                    next[i] = { ...n, endpointId: e.target.value };
                    setNodes(next);
                  }}
                >
                  {endpoints.map((ep) => (
                    <option key={ep.id} value={ep.id}>
                      [{ep.method}] {ep.name} — {ep.path}
                    </option>
                  ))}
                </select>
                <input
                  className="input py-1.5 w-44"
                  placeholder="别名（可选）"
                  value={n.alias ?? ""}
                  onChange={(e) => {
                    const next = nodes.slice();
                    next[i] = { ...n, alias: e.target.value };
                    setNodes(next);
                  }}
                />
                <button
                  className="btn-ghost p-1.5 text-rose-300"
                  onClick={() => setNodes(nodes.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              {i < nodes.length - 1 && (
                <div className="flex justify-center mt-2 -mb-1 text-slate-500">
                  <ArrowDown className="w-4 h-4 animate-pulse" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <button className="btn-ghost w-full justify-center py-3 border border-dashed border-white/10" onClick={addNode}>
          <Plus className="w-4 h-4" /> 添加步骤
        </button>
      </div>

      {runResult && <FlowRunResult result={runResult} />}
    </div>
  );
}

function FlowRunResult({ result }: { result: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4 space-y-3"
    >
      <div className="font-medium text-white">执行结果</div>
      <div className="space-y-2">
        {result.steps.map((s: any, i: number) => {
          const r = s.result;
          const ok = r && !r.error && r.status < 400;
          return (
            <div key={s.nodeId ?? i} className="rounded-lg border border-white/5 bg-bg-elevated/40 p-3">
              <div className="flex items-center gap-2 text-sm">
                {ok ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                <span className="text-white">#{i + 1} {s.endpointName}</span>
                <span className={`font-semibold ${statusClass(r?.status)}`}>{r?.status ?? "ERR"}</span>
                <span className="text-xs text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" /> {r?.durationMs}ms
                </span>
              </div>
              <details className="mt-2">
                <summary className="text-xs text-slate-400 cursor-pointer">详情</summary>
                <div className="mt-2 space-y-2">
                  <JsonEditor value={stringifyPretty(r?.responseBody)} onChange={() => {}} height={160} />
                  {r?.extracted && Object.keys(r.extracted).length > 0 && (
                    <>
                      <div className="text-xs text-slate-500">提取变量</div>
                      <JsonEditor value={stringifyPretty(r.extracted)} onChange={() => {}} height={100} />
                    </>
                  )}
                </div>
              </details>
            </div>
          );
        })}
      </div>
      <details>
        <summary className="text-xs text-slate-400 cursor-pointer">最终变量池</summary>
        <div className="mt-2">
          <JsonEditor value={stringifyPretty(result.scope)} onChange={() => {}} height={200} />
        </div>
      </details>
    </motion.div>
  );
}
