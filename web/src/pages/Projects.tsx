import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Boxes, Trash2, Edit3, Globe2, Save } from "lucide-react";
import { toast } from "sonner";
import { api, Project, Environment } from "@/lib/api";
import Modal from "@/components/Modal";
import Empty from "@/components/Empty";
import JsonEditor from "@/components/JsonEditor";
import KeyValueEditor, { KV, recordToRows, rowsToRecord } from "@/components/KeyValueEditor";
import { useAppStore } from "@/store/app";
import { safeJson, stringifyPretty } from "@/lib/utils";

type EnvDraft = Partial<Environment> & { _headers: KV[] };

export default function ProjectsPage() {
  const qc = useQueryClient();
  const { activeProjectId, setActiveProject } = useAppStore();
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: () => api.get<Project[]>("/api/projects"),
  });
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<Project> | null>(null);
  const [envOpen, setEnvOpen] = useState(false);
  const [envEditing, setEnvEditing] = useState<EnvDraft | null>(null);

  const saveProject = useMutation({
    mutationFn: async (p: Partial<Project>) => {
      if (p.id) return api.patch(`/api/projects/${p.id}`, p);
      return api.post("/api/projects", p);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setEditOpen(false);
      toast.success("已保存");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProject = useMutation({
    mutationFn: (id: string) => api.del(`/api/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("已删除");
    },
  });

  const saveEnv = useMutation({
    mutationFn: async (e: Partial<Environment>) => {
      if (e.id) return api.patch(`/api/environments/${e.id}`, e);
      return api.post("/api/environments", e);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects"] });
      setEnvOpen(false);
      toast.success("环境已保存");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEnv = useMutation({
    mutationFn: (id: string) => api.del(`/api/environments/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["projects"] }),
  });

  const openNew = () => {
    setEditing({ name: "", description: "" });
    setEditOpen(true);
  };

  const openEdit = (p: Project) => {
    setEditing({ ...p });
    setEditOpen(true);
  };

  const openEnvEdit = (projectId: string, env?: Environment) => {
    const base = env ?? { projectId, name: "", baseUrl: "", headers: "{}", variables: "{}" };
    setEnvEditing({
      ...base,
      _headers: recordToRows(safeJson(base.headers, {}) as Record<string, string>),
    });
    setEnvOpen(true);
  };

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-start gap-3 justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">项目 & 环境</h1>
          <p className="text-sm text-slate-400 mt-1">一个项目可关联多个环境（dev / 测试 / 预发 / 生产）。</p>
        </div>
        <button className="btn-primary shrink-0" onClick={openNew}>
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">新建项目</span>
          <span className="sm:hidden">新建</span>
        </button>
      </div>

      {projects.length === 0 ? (
        <Empty
          icon={<Boxes className="w-6 h-6" />}
          title="还没有项目"
          hint="先创建一个项目，再为它添加不同环境的 baseUrl 和公共变量。"
          action={
            <button className="btn-primary" onClick={openNew}>
              <Plus className="w-4 h-4" />
              新建第一个项目
            </button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AnimatePresence>
            {projects.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96 }}
                className={`card p-5 transition-shadow ${
                  activeProjectId === p.id
                    ? "ring-2 ring-brand/80 shadow-glow"
                    : "hover:ring-1 hover:ring-white/10"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-medium text-white">{p.name}</div>
                      {activeProjectId === p.id && (
                        <span className="chip bg-brand/20 text-brand-glow text-[10px] px-1.5 py-0.5">
                          ✓ 当前
                        </span>
                      )}
                      <span className="chip bg-white/5 text-slate-400">
                        {p._count?.endpoints ?? 0} 接口
                      </span>
                    </div>
                    {p.description && (
                      <div className="text-xs text-slate-400 mt-1">{p.description}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {activeProjectId !== p.id && (
                      <button
                        className="btn-ghost px-2 py-1 text-xs"
                        onClick={() => setActiveProject(p.id)}
                      >
                        切换到此
                      </button>
                    )}
                    <button className="btn-ghost p-1.5" aria-label="编辑项目" onClick={() => openEdit(p)}>
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      className="btn-ghost p-1.5 hover:text-rose-300"
                      aria-label="删除项目"
                      onClick={() => {
                        if (confirm(`删除项目 ${p.name}？其下所有环境、接口都会被清理`)) {
                          deleteProject.mutate(p.id);
                        }
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <Globe2 className="w-3.5 h-3.5" />
                      环境
                    </div>
                    <button
                      className="btn-ghost px-2 py-1 text-xs"
                      onClick={() => openEnvEdit(p.id)}
                    >
                      <Plus className="w-3 h-3" />
                      添加
                    </button>
                  </div>
                  {(p.environments ?? []).length === 0 ? (
                    <div className="text-xs text-slate-500">尚未添加环境</div>
                  ) : (
                    <div className="space-y-1.5">
                      {p.environments!.map((env) => (
                        <div
                          key={env.id}
                          className="flex items-center justify-between px-3 py-2 rounded-md bg-bg-elevated/40 hover:bg-bg-elevated/80 text-xs group"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="chip bg-brand/15 text-brand-glow">{env.name}</span>
                            <span className="font-mono text-slate-400 truncate">
                              {env.baseUrl}
                            </span>
                          </div>
                          <div className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center gap-1 shrink-0">
                            <button
                              className="btn-ghost p-1"
                              onClick={() => openEnvEdit(p.id, env)}
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                            <button
                              className="btn-ghost p-1 hover:text-rose-300"
                              onClick={() => confirm(`删除环境 ${env.name}？`) && deleteEnv.mutate(env.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={editing?.id ? "编辑项目" : "新建项目"}>
        {editing && (
          <div className="space-y-3">
            <Field label="名称">
              <input
                className="input"
                value={editing.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                placeholder="例如 订阅中心"
              />
            </Field>
            <Field label="描述">
              <input
                className="input"
                value={editing.description ?? ""}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                placeholder="可选"
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setEditOpen(false)}>
                取消
              </button>
              <button
                className="btn-primary"
                disabled={!editing.name}
                onClick={() => saveProject.mutate(editing)}
              >
                <Save className="w-4 h-4" /> 保存
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={envOpen}
        onClose={() => setEnvOpen(false)}
        title={envEditing?.id ? "编辑环境" : "新建环境"}
        width="max-w-2xl"
      >
        {envEditing && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="名称">
                <input
                  className="input"
                  value={envEditing.name ?? ""}
                  onChange={(e) => setEnvEditing({ ...envEditing, name: e.target.value })}
                  placeholder="dev / test / prod"
                />
              </Field>
              <Field label="baseUrl">
                <input
                  className="input font-mono"
                  value={envEditing.baseUrl ?? ""}
                  onChange={(e) => setEnvEditing({ ...envEditing, baseUrl: e.target.value })}
                  placeholder="https://api.example.com"
                />
              </Field>
            </div>
            <Field label="公共请求头">
              <KeyValueEditor
                rows={envEditing._headers}
                onChange={(rows) => setEnvEditing({ ...envEditing, _headers: rows })}
                keyPlaceholder="Authorization / Cookie / X-Custom"
                valuePlaceholder="值（Cookie 多个用分号隔开：a=1; b=2）"
              />
            </Field>
            <Field
              label="公共变量（JSON）"
              hint="接口中可以通过 {{key}} 使用；运行时如果开启了提取，token 等也会回写到这里"
            >
              <JsonEditor
                value={
                  typeof envEditing.variables === "string"
                    ? envEditing.variables
                    : stringifyPretty(envEditing.variables ?? {})
                }
                onChange={(v) => setEnvEditing({ ...envEditing, variables: v })}
                height={160}
              />
            </Field>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost" onClick={() => setEnvOpen(false)}>
                取消
              </button>
              <button
                className="btn-primary"
                disabled={!envEditing.name || !envEditing.baseUrl}
                onClick={() => {
                  const normalize = (v: unknown) => {
                    if (typeof v !== "string") return JSON.stringify(v ?? {});
                    try {
                      JSON.parse(v);
                      return v;
                    } catch {
                      toast.error("JSON 格式错误");
                      throw new Error("bad json");
                    }
                  };
                  try {
                    const { _headers, ...rest } = envEditing;
                    saveEnv.mutate({
                      ...rest,
                      headers: JSON.stringify(rowsToRecord(_headers)),
                      variables: normalize(rest.variables),
                    });
                  } catch {
                    /* surfaced via toast */
                  }
                }}
              >
                <Save className="w-4 h-4" /> 保存
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-slate-400">{label}</span>
        {hint && <span className="text-[11px] text-slate-500">{hint}</span>}
      </div>
      {children}
    </label>
  );
}
