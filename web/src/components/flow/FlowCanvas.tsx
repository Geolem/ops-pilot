import { useCallback, useEffect, useMemo, useRef } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Node,
  Edge,
  Connection,
  addEdge,
  useNodesState,
  useEdgesState,
  MarkerType,
  ReactFlowProvider,
} from "reactflow";
import "reactflow/dist/style.css";
import EndpointNode, { EndpointNodeData } from "./EndpointNode";
import { Endpoint } from "@/lib/api";

const nodeTypes = { endpoint: EndpointNode };

export interface FlowGraph {
  nodes: Node<EndpointNodeData>[];
  edges: Edge[];
}

export default function FlowCanvas(props: {
  value: FlowGraph;
  onChange: (graph: FlowGraph) => void;
  endpoints: Endpoint[];
  runStates: Record<string, { status: "idle" | "running" | "success" | "error"; httpStatus?: number | null; durationMs?: number | null }>;
}) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function FlowCanvasInner({
  value,
  onChange,
  endpoints,
  runStates,
}: {
  value: FlowGraph;
  onChange: (graph: FlowGraph) => void;
  endpoints: Endpoint[];
  runStates: Record<string, { status: "idle" | "running" | "success" | "error"; httpStatus?: number | null; durationMs?: number | null }>;
}) {
  const [nodes, setNodes, onNodesChange] = useNodesState<EndpointNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const externalChange = useRef(false);
  const lastEmitted = useRef<string>("");

  useEffect(() => {
    externalChange.current = true;
    const hydrated = value.nodes.map((n) => ({
      ...n,
      type: n.type ?? "endpoint",
      data: {
        ...n.data,
        endpoint: endpoints.find((e) => e.id === n.data.endpointId) ?? null,
        endpoints,
        status: runStates[n.id]?.status ?? "idle",
        httpStatus: runStates[n.id]?.httpStatus,
        durationMs: runStates[n.id]?.durationMs,
        onChange: (patch: { endpointId?: string; alias?: string }) => {
          setNodes((cur) =>
            cur.map((node) =>
              node.id === n.id
                ? {
                    ...node,
                    data: {
                      ...node.data,
                      ...(patch.endpointId !== undefined
                        ? {
                            endpointId: patch.endpointId,
                            endpoint: endpoints.find((e) => e.id === patch.endpointId) ?? null,
                          }
                        : {}),
                      ...(patch.alias !== undefined ? { alias: patch.alias } : {}),
                    },
                  }
                : node
            )
          );
        },
      } as EndpointNodeData & { endpointId: string },
    }));
    setNodes(hydrated);
    setEdges(
      value.edges.map((e) => ({
        ...e,
        animated: runStates[e.source]?.status === "running",
        markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
        style: { stroke: "#6366f1", strokeWidth: 1.5 },
      }))
    );
    queueMicrotask(() => (externalChange.current = false));
  }, [value.nodes.length, value.edges.length, endpoints.length, runStates, value]);

  useEffect(() => {
    if (externalChange.current) return;
    const stripped = {
      nodes: nodes.map((n) => ({
        id: n.id,
        type: "endpoint",
        position: n.position,
        data: { endpointId: (n.data as any).endpointId ?? n.data.endpoint?.id ?? "", alias: n.data.alias },
      })) as unknown as Node<EndpointNodeData>[],
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })) as Edge[],
    };
    const signature = JSON.stringify(stripped);
    if (signature === lastEmitted.current) return;
    lastEmitted.current = signature;
    onChange(stripped);
  }, [nodes, edges]);

  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((eds) =>
        addEdge(
          {
            ...c,
            id: `e-${c.source}-${c.target}`,
            markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
            style: { stroke: "#6366f1", strokeWidth: 1.5 },
          },
          eds
        )
      ),
    [setEdges]
  );

  const memoNodeTypes = useMemo(() => nodeTypes, []);

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={memoNodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          markerEnd: { type: MarkerType.ArrowClosed, color: "#6366f1" },
          style: { stroke: "#6366f1", strokeWidth: 1.5 },
        }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#1f2937" />
        <MiniMap pannable zoomable className="!bg-bg-panel/70 !border-white/5 rounded-lg overflow-hidden" maskColor="rgba(11,15,26,0.7)" nodeColor="#6366f1" />
        <Controls className="!bg-bg-panel/70 !border-white/5 !shadow-soft [&>button]:!bg-transparent [&>button]:!border-white/5 [&>button]:!text-slate-300 [&>button:hover]:!bg-bg-hover" />
      </ReactFlow>
    </div>
  );
}
