import { motion, AnimatePresence } from "framer-motion";
import { Sun, Moon, Monitor } from "lucide-react";
import { useThemeStore, Theme } from "@/store/theme";

const icons: Record<Theme, typeof Sun> = { dark: Moon, light: Sun, system: Monitor };
const labels: Record<Theme, string> = { dark: "深色", light: "浅色", system: "跟随系统" };

export default function ThemeToggle() {
  const { theme, cycle } = useThemeStore();
  const Icon = icons[theme];

  return (
    <button
      onClick={cycle}
      title={`当前：${labels[theme]}，点击切换`}
      className="btn-ghost p-2 relative overflow-hidden"
      aria-label="切换主题"
    >
      <AnimatePresence mode="wait">
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.7 }}
          transition={{ duration: 0.18 }}
          className="flex items-center gap-1"
        >
          <Icon className="w-4 h-4" />
          <span className="text-xs hidden sm:inline">{labels[theme]}</span>
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
