import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, Boxes, Gauge, Workflow, History, Settings } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", icon: Gauge, label: "仪表盘" },
  { to: "/projects", icon: Boxes, label: "项目" },
  { to: "/endpoints", icon: Activity, label: "接口" },
  { to: "/flows", icon: Workflow, label: "编排" },
  { to: "/history", icon: History, label: "历史" },
  { to: "/settings", icon: Settings, label: "设置" },
];

export default function Sidebar() {
  const location = useLocation();
  return (
    <aside className="w-60 shrink-0 border-r border-white/5 bg-bg-panel/40 backdrop-blur-lg flex flex-col">
      <div className="px-5 py-5 flex items-center gap-3">
        <motion.div
          initial={{ rotate: -20, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 14 }}
          className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-accent flex items-center justify-center shadow-glow"
        >
          <svg viewBox="0 0 64 64" className="w-6 h-6">
            <path
              d="M14 46 L32 16 L50 46 Z M24 46 L32 32 L40 46"
              fill="none"
              stroke="white"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>
        <div>
          <div className="font-semibold text-white tracking-wide">OpsPilot</div>
          <div className="text-[11px] text-slate-400">运维副驾驶</div>
        </div>
      </div>

      <nav className="px-2 flex-1">
        {items.map((it) => {
          const active = location.pathname === it.to || (it.to !== "/" && location.pathname.startsWith(it.to));
          return (
            <NavLink
              key={it.to}
              to={it.to}
              className={cn(
                "group relative flex items-center gap-3 px-3 py-2 my-0.5 rounded-lg text-sm transition-all",
                active
                  ? "bg-gradient-to-r from-brand/20 to-transparent text-white"
                  : "text-slate-400 hover:text-white hover:bg-bg-hover/50"
              )}
            >
              {active && (
                <motion.span
                  layoutId="nav-indicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-gradient-to-b from-brand to-accent rounded-r"
                  transition={{ type: "spring", stiffness: 350, damping: 28 }}
                />
              )}
              <it.icon className="w-4 h-4" />
              <span>{it.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-white/5 text-[11px] text-slate-500">
        v0.1 · 本地自托管
      </div>
    </aside>
  );
}
