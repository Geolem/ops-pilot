import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Plus,
  Play,
  Save,
  Trash2,
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
import JsonEditor from "@/components/JsonEditor";
import FlowCanvas from "@/components/flow/FlowCanvas";
import { EndpointFlowNode, EndpointNodeData } from "@/components/flow/EndpointNode";
import { ConditionFlowEdge } from "@/components/flow/ConditionEdge";
import { statusClass, stringifyPretty } from "@/lib/utils";

type RunStates = Record<
  string,
  { status: "idle" | "running" | "success" | "error"; httpStatus?: number | null; durationMs?: number | null }
>;

export default function FlowsPage() {
  const qc = useQueryClient();
  const { activeProjectId, activeEnvironmentId } = useAppStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: flows = [], isLoading: flowsLoading } = useQuery({
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
      api.post<Flow>("/api/flows", {
        projectId: activeProjectId,
        name,
        nodes: "[]",
        edges: "[]",
      }),
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
    <div className="h-full flex flex-col">
      {/* Mobile notice — canvas isn't usable on small screens */}
      <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-amber-500/10 border-b border-amber-500/20 text-sm text-amber-300">
        <Workflow className="w-4 h-4 shrink-0" />
        编排画布需要较大屏幕，建议在桌面端使用。手机上可查看编排列表，但无法编辑节点。
      </div>
    <div className="flex-1 grid md:grid-cols-[260px_1fr] min-h-0">
      <div className="border-r border-white/5 bg-bg-panel/30 flex flex-col min-h-0">
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
          {flowsLoading ? (
            <div className="flex items-center justify-center py-8 text-slate-500 text-sm gap-2">
              <Workflow className="w-4 h-4 animate-pulse" /> 加载中…
            </div>
          ) : flows.length === 0 ? (
            <Empty title="还没有编排" hint="点击右上角 + 新建编排" />
          ) : null}
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

      <div className="min-h-0 overflow-hidden">
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
  const [graph, setGraph] = useState<{ nodes: EndpointFlowNode[]; edges: ConditionFlowEdge[] }>(() => hydrate(flow, endpoints));
  const [name, setName] = useState(flow.name);
  const [description, setDescription] = useState(flow.description ?? "");
  const [runResult, setRunResult] = useState<any>(null);
  const [runStates, setRunStates] = useState<RunStates>({});

  useEffect(() => {
    setGraph(hydrate(flow, endpoints));
    setName(flow.name);
    setDescription(flow.description ?? "");
    setRunResult(null);
    setRunStates({});
  }, [flow.id]);

  const save = useMutation({
    mutationFn: () =>
      api.patch<Flow>(`/api/flows/${flow.id}`, {
        name,
        description,
        nodes: JSON.stringify(
          graph.nodes.map((n) => ({
            id: n.id,
            type: "endpoint",
            position: n.position,
            data: {
              endpointId: (n.data as any).endpointId ?? n.data.endpoint?.id ?? "",
              alias: n.data.alias,
            },
          }))
        ),
        edges: JSON.stringify(graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, data: { condition: (e.data as any)?.condition ?? null } }))),
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
    mutationFn: () => {
      const payloadNodes = graph.nodes.map((n) => ({
        id: n.id,
        endpointId: (n.data as any).endpointId ?? n.data.endpoint?.id ?? "",
        alias: n.data.alias,
      })).filter((n) => n.endpointId);
      const payloadEdges = graph.edges.map((e) => ({ source: e.source, target: e.target, condition: (e.data as any)?.condition ?? null }));
      setRunStates(Object.fromEntries(payloadNodes.map((n) => [n.id, { status: "running" }])));
      return api.post<any>("/api/flows/run", {
        environmentId: environmentId ?? undefined,
        nodes: payloadNodes,
        edges: payloadEdges,
      });
    },
    onSuccess: (r) => {
      setRunResult(r);
      const states: RunStates = {};
      for (const step of r.steps) {
        const s = step.result;
        states[step.nodeId] = {
          status: s && !s.error && s.status < 400 ? "success" : "error",
          httpStatus: s?.status,
          durationMs: s?.durationMs,
        };
      }
      for (const n of graph.nodes) if (!states[n.id]) states[n.id] = { status: "idle" };
      setRunStates(states);
    },
    onError: () => {
      setRunStates({});
      toast.error("执行失败");
    },
  });

  const addNode = () => {
    const id = Math.random().toString(36).slice(2, 9);
    const last = graph.nodes[graph.nodes.length - 1];
    const position = last
      ? { x: last.position.x, y: last.position.y + 180 }
      : { x: 80, y: 80 };
    const newNode: EndpointFlowNode = {
      id,
      type: "endpoint",
      position,
      data: {
        endpoint: endpoints[0] ?? null,
        endpoints,
        alias: "",
      } as EndpointNodeData & { endpointId: string },
    };
    (newNode.data as any).endpointId = endpoints[0]?.id ?? "";
    setGraph({ nodes: [...graph.nodes, newNode], edges: graph.edges });
  };

  const runDisabledReason = !environmentId
    ? "请先在顶部选择环境"
    : graph.nodes.length === 0
      ? "请先添加节点"
      : "";

  return (
    <div className="h-full flex flex-col">
      <div className="px-5 py-3 border-b border-white/5 bg-bg-panel/20 flex items-center gap-3">
        <input
          className="input text-sm font-medium max-w-xs"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="input text-sm flex-1"
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="描述（可选）"
        />
        <div className="flex gap-1">
          <button className="btn-ghost" onClick={addNode}>
            <Plus className="w-3.5 h-3.5" /> 添加节点
          </button>
          <button className="btn-ghost" onClick={() => save.mutate()}>
            <Save className="w-3.5 h-3.5" /> 保存
          </button>
          <span className="inline-flex" title={runDisabledReason || "运行"}>
            <button
              className="btn-primary"
              onClick={() => run.mutate()}
              disabled={run.isPending || !!runDisabledReason}
            >
              <Play className="w-3.5 h-3.5" />
              {run.isPending ? "执行中…" : "运行"}
            </button>
          </span>
          {runDisabledReason && (
            <span className="hidden xl:inline-flex items-center text-[11px] text-amber-400">
              {runDisabledReason}
            </span>
          )}
          <button
            className="btn-danger"
            onClick={() => confirm(`删除编排 ${flow.name}？`) && del.mutate()}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 relative">
        <FlowCanvas value={graph} onChange={setGraph} endpoints={endpoints} runStates={runStates} />
        {graph.nodes.length === 0 && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="text-sm text-slate-500 pointer-events-auto">
              点击顶部「添加节点」，然后拖动连接节点间的圆点来定义执行顺序
            </div>
          </div>
        )}
      </div>

      {runResult && (
        <div className="border-t border-white/5 max-h-[40%] overflow-auto p-4 bg-bg-panel/30">
          <FlowRunResult result={runResult} />
        </div>
      )}
    </div>
  );
}

function hydrate(flow: Flow, endpoints: Endpoint[]): { nodes: EndpointFlowNode[]; edges: ConditionFlowEdge[] } {
  let rawNodes: any[] = [];
  let rawEdges: any[] = [];
  try {
    rawNodes = JSON.parse(flow.nodes || "[]");
  } catch {
    rawNodes = [];
  }
  try {
    rawEdges = JSON.parse(flow.edges || "[]");
  } catch {
    rawEdges = [];
  }

  const isReactFlowFormat = rawNodes.length > 0 && rawNodes[0]?.position;
  let nodes: EndpointFlowNode[];
  let edges: ConditionFlowEdge[];

  if (isReactFlowFormat) {
    nodes = rawNodes.map((n) => ({
      id: n.id,
      type: "endpoint",
      position: n.position,
      data: {
        endpointId: n.data?.endpointId,
        alias: n.data?.alias,
        endpoint: endpoints.find((e) => e.id === n.data?.endpointId) ?? null,
        endpoints,
      } as EndpointNodeData & { endpointId: string },
    }));
    edges = rawEdges.map((e) => ({
      id: e.id ?? `e-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      data: { condition: e.data?.condition ?? e.condition ?? null },
    }));
  } else {
    nodes = rawNodes.map((n, i) => ({
      id: n.id ?? String(i),
      type: "endpoint",
      position: { x: 80, y: 80 + i * 180 },
      data: {
        endpointId: n.endpointId,
        alias: n.alias,
        endpoint: endpoints.find((e) => e.id === n.endpointId) ?? null,
        endpoints,
      } as EndpointNodeData & { endpointId: string },
    }));
    edges = [];
    for (let i = 0; i < nodes.length - 1; i++) {
      edges.push({ id: `e-${nodes[i].id}-${nodes[i + 1].id}`, source: nodes[i].id, target: nodes[i + 1].id });
    }
  }

  return { nodes, edges };
}

function FlowRunResult({ result }: { result: any }) {
  return (
    <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className="font-medium text-white text-sm">执行结果</div>
      <div className="space-y-2">
        {result.steps.map((s: any, i: number) => {
          const r = s.result;
          const ok = r && !r.error && r.status < 400;
          return (
            <div key={s.nodeId ?? i} className="rounded-lg border border-white/5 bg-bg-elevated/40 p-3">
              <div className="flex items-center gap-2 text-sm flex-wrap">
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
