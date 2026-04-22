import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import MethodBadge from "@/components/MethodBadge";
import Empty from "@/components/Empty";
import { statusClass } from "@/lib/utils";
import { History as HistoryIcon, Clock } from "lucide-react";

interface HistoryItem {
  id: string;
  method: string;
  url: string;
  status: number | null;
  durationMs: number | null;
  error: string | null;
  createdAt: string;
}

export default function HistoryPage() {
  const { data = [] } = useQuery({
    queryKey: ["history"],
    queryFn: () => api.get<HistoryItem[]>("/api/history?limit=100"),
    refetchInterval: 5000,
  });

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-white">执行历史</h1>
        <p className="text-sm text-slate-400 mt-1">最近 100 条调用记录（每 5s 自动刷新）。</p>
      </div>
      {data.length === 0 ? (
        <Empty icon={<HistoryIcon className="w-5 h-5" />} title="暂无记录" />
      ) : (
        <div className="card divide-y divide-white/5">
          {data.map((h, i) => (
            <motion.div
              key={h.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.01, 0.3) }}
              className="px-4 py-2.5 flex items-center gap-3 text-sm hover:bg-bg-hover/40"
            >
              <MethodBadge method={h.method} />
              <span className={`font-semibold w-12 text-center ${statusClass(h.status)}`}>
                {h.status || "ERR"}
              </span>
              <span className="font-mono text-xs text-slate-300 truncate flex-1">{h.url}</span>
              <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                <Clock className="w-3 h-3" /> {h.durationMs}ms
              </span>
              <span className="text-xs text-slate-500 shrink-0 w-36 text-right">
                {new Date(h.createdAt).toLocaleString()}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
