import { NavLink, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Activity, Boxes, Gauge, Workflow, History, Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/",          icon: Gauge,    label: "仪表盘" },
  { to: "/projects",  icon: Boxes,    label: "项目" },
  { to: "/endpoints", icon: Activity, label: "接口" },
  { to: "/flows",     icon: Workflow, label: "编排" },
  { to: "/history",   icon: History,  label: "历史" },
  { to: "/settings",  icon: Settings, label: "设置" },
];

function Logo() {
  return (
    <motion.div
      initial={{ rotate: -20, scale: 0.8 }}
      animate={{ rotate: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 220, damping: 14 }}
      className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand to-accent flex items-center justify-center shadow-glow shrink-0"
    >
      <svg viewBox="0 0 64 64" className="w-6 h-6">
        <path
          d="M14 46 L32 16 L50 46 Z M24 46 L32 32 L40 46"
          fill="none" stroke="white" strokeWidth="4"
          strokeLinejoin="round" strokeLinecap="round"
        />
      </svg>
    </motion.div>
  );
}

export default function Sidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const location = useLocation();
  const isActive = (to: string) =>
    to === "/" ? location.pathname === "/" : location.pathname.startsWith(to);

  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────────────── */}
      <aside
        className={cn(
          "hidden md:flex flex-col shrink-0 border-r border-black/[0.06] dark:border-white/5",
          "bg-white/60 dark:bg-bg-panel/40 backdrop-blur-xl",
          "transition-[width] duration-300 ease-in-out overflow-hidden",
          collapsed ? "w-[60px]" : "w-56"
        )}
      >
        {/* Logo area */}
        <div
          className={cn(
            "flex items-center border-b border-black/[0.05] dark:border-white/5 shrink-0",
            collapsed ? "justify-center py-4" : "gap-3 px-4 py-5"
          )}
        >
          <Logo />
          {!collapsed && (
            <div className="min-w-0 overflow-hidden">
              <div className="font-semibold text-stone-900 dark:text-white tracking-wide text-[15px] whitespace-nowrap">OpsPilot</div>
              <div className="text-[11px] text-stone-400 dark:text-slate-500 whitespace-nowrap">运维副驾驶</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-2 space-y-0.5">
          {items.map((it) => {
            const active = isActive(it.to);
            return (
              <div key={it.to} className="relative group/item">
                <NavLink
                  to={it.to}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl text-sm transition-all duration-200",
                    collapsed ? "justify-center p-3" : "px-3 py-2.5",
                    active
                      ? "bg-brand/10 text-brand dark:text-brand font-medium"
                      : "text-stone-500 dark:text-slate-400 hover:text-stone-800 dark:hover:text-white hover:bg-black/[0.04] dark:hover:bg-bg-hover/50"
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 bg-gradient-to-b from-brand to-accent rounded-r"
                      transition={{ type: "spring", stiffness: 350, damping: 28 }}
                    />
                  )}
                  <it.icon
                    className={cn(
                      "w-4 h-4 shrink-0 transition-transform duration-200",
                      active ? "text-brand" : "group-hover/item:scale-110"
                    )}
                  />
                  {!collapsed && <span className="truncate">{it.label}</span>}
                </NavLink>

                {/* Tooltip — only in collapsed mode */}
                {collapsed && (
                  <div className={cn(
                    "absolute left-full ml-2.5 top-1/2 -translate-y-1/2 z-50",
                    "px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap",
                    "bg-white dark:bg-bg-elevated",
                    "text-stone-800 dark:text-white",
                    "border border-black/[0.07] dark:border-white/10",
                    "shadow-[0_4px_16px_rgba(0,0,0,0.12)] dark:shadow-[0_4px_16px_rgba(0,0,0,0.4)]",
                    "opacity-0 pointer-events-none group-hover/item:opacity-100 transition-opacity duration-150"
                  )}>
                    {it.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Bottom: version + collapse toggle */}
        <div
          className={cn(
            "border-t border-black/[0.05] dark:border-white/5 flex items-center shrink-0",
            collapsed ? "justify-center p-2" : "px-3 py-2.5 gap-2"
          )}
        >
          {!collapsed && (
            <span className="text-[11px] text-stone-400 dark:text-slate-500 flex-1 truncate">
              v0.1 · 本地自托管
            </span>
          )}
          <button
            onClick={onToggle}
            title={collapsed ? "展开菜单" : "折叠菜单"}
            className={cn(
              "p-1.5 rounded-lg transition-all duration-150",
              "text-stone-400 dark:text-slate-500",
              "hover:text-stone-700 dark:hover:text-slate-200",
              "hover:bg-black/[0.05] dark:hover:bg-white/8"
            )}
          >
            {collapsed
              ? <ChevronRight className="w-4 h-4" />
              : <ChevronLeft className="w-4 h-4" />
            }
          </button>
        </div>
      </aside>

      {/* ── Mobile bottom nav ────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex bg-white/85 dark:bg-bg-panel/90 backdrop-blur-xl border-t border-black/[0.06] dark:border-white/5 safe-area-bottom">
        {items.map((it) => {
          const active = isActive(it.to);
          return (
            <NavLink
              key={it.to}
              to={it.to}
              className={cn(
                "flex-1 flex flex-col items-center py-2 gap-0.5 transition-colors duration-150",
                active ? "text-brand" : "text-stone-400 dark:text-slate-500"
              )}
            >
              <it.icon className={cn("w-5 h-5 transition-transform duration-150", active && "scale-110")} />
              <span className="text-[10px] font-medium">{it.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </>
  );
}
