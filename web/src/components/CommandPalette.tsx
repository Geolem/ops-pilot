import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Search, X, CornerDownLeft } from "lucide-react";
import { api, Endpoint } from "@/lib/api";
import { useAppStore } from "@/store/app";
import { useShortcut } from "@/hooks/useShortcut";
import MethodBadge from "./MethodBadge";

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { setActiveProject, setPendingEndpointId } = useAppStore();

  const openPalette = useCallback(() => { setOpen(true); }, []);
  const closePalette = useCallback(() => setOpen(false), []);

  useShortcut("k", openPalette, { cmdOrCtrl: true });
  useShortcut("Escape", closePalette, { enabled: open });

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Fetch all endpoints across all projects (no projectId filter)
  const { data: allEndpoints = [] } = useQuery({
    queryKey: ["endpoints-all"],
    queryFn: () => api.get<Endpoint[]>("/api/endpoints"),
    staleTime: 30_000,
    enabled: open,
  });

  const filtered = allEndpoints
    .filter((ep) => {
      const q = query.trim().toLowerCase();
      if (!q) return true;
      return (
        ep.name.toLowerCase().includes(q) ||
        ep.path.toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q)
      );
    })
    .slice(0, 14);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
      } else if (e.key === "Enter" && filtered[cursor]) {
        e.preventDefault();
        select(filtered[cursor]);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, cursor, filtered]);

  // Keep cursor in view
  useEffect(() => {
    const el = listRef.current?.children[cursor] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  // Reset cursor on query change
  useEffect(() => { setCursor(0); }, [query]);

  const select = (ep: Endpoint) => {
    setActiveProject(ep.projectId);
    setPendingEndpointId(ep.id);
    navigate("/endpoints");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] bg-black/50 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="w-full max-w-xl mx-4 bg-bg-panel border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-slate-500 outline-none"
            placeholder="搜索接口名称、路径、方法…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="flex items-center gap-1.5 shrink-0">
            <kbd className="text-[10px] text-slate-500 border border-white/10 rounded px-1.5 py-0.5 font-mono">Esc</kbd>
            <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[380px] overflow-auto py-1.5">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              {query ? "无匹配结果" : "暂无接口"}
            </div>
          ) : (
            filtered.map((ep, i) => (
              <button
                key={ep.id}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  i === cursor ? "bg-brand/15" : "hover:bg-white/5"
                }`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => select(ep)}
              >
                <MethodBadge method={ep.method} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-white truncate">{ep.name}</div>
                  <div className="text-[11px] font-mono text-slate-400 truncate">{ep.path}</div>
                </div>
                {i === cursor && (
                  <CornerDownLeft className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-white/5 text-[10px] text-slate-600">
          <span><kbd className="font-mono border border-white/10 rounded px-1">↑↓</kbd> 浏览</span>
          <span><kbd className="font-mono border border-white/10 rounded px-1">↵</kbd> 跳转</span>
          <span><kbd className="font-mono border border-white/10 rounded px-1">⌘K</kbd> 打开</span>
          <span className="ml-auto">{allEndpoints.length} 个接口</span>
        </div>
      </div>
    </div>
  );
}
