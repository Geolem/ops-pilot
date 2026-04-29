import { motion } from "framer-motion";
import { ReactNode } from "react";

export default function Empty({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center text-center py-20 px-6"
      role="status"
    >
      {icon && (
        <div className="w-14 h-14 rounded-2xl bg-bg-elevated border border-black/[0.06] dark:border-white/5 flex items-center justify-center mb-4 text-slate-400">
          {icon}
        </div>
      )}
      <div className="panel-title text-base mb-1">{title}</div>
      {hint && <div className="text-slate-500 text-sm leading-6 max-w-md">{hint}</div>}
      {action && <div className="mt-4">{action}</div>}
    </motion.div>
  );
}
