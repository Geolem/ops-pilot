import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Check } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export default function Select({
  value,
  onChange,
  options,
  placeholder,
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLButtonElement>(null);

  const updatePos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    const dropH = Math.min((options.length + (placeholder ? 1 : 0)) * 36 + 12, 280);
    const below = window.innerHeight - r.bottom >= dropH || window.innerHeight - r.bottom >= r.top;
    setDropStyle(
      below
        ? { top: r.bottom + 4, left: r.left, width: Math.max(r.width, 160) }
        : { bottom: window.innerHeight - r.top + 4, left: r.left, width: Math.max(r.width, 160) }
    );
  }, [options.length, placeholder]);

  const handleOpen = () => {
    if (disabled) return;
    updatePos();
    setOpen((v) => !v);
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (triggerRef.current && !triggerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") setOpen(false);
    if ((e.key === "Enter" || e.key === " ") && !open) { e.preventDefault(); handleOpen(); }
  };

  const selected = options.find((o) => o.value === value);
  const isPlaceholder = !selected && !!placeholder;

  const allOptions: SelectOption[] = placeholder
    ? [{ value: "", label: placeholder }, ...options]
    : options;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleOpen}
        onKeyDown={handleKey}
        disabled={disabled}
        className={[
          "input flex items-center justify-between gap-2 text-left w-full cursor-pointer select-none",
          disabled ? "opacity-50 cursor-not-allowed" : "",
          open ? "border-brand/50 shadow-[0_0_0_3px_rgba(249,115,22,0.12)]" : "",
        ].join(" ")}
      >
        <span className={`truncate flex-1 min-w-0 ${isPlaceholder ? "text-slate-500 dark:text-slate-500" : ""}`}>
          {selected?.label ?? placeholder ?? ""}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.13, ease: "easeOut" }}
              style={{ position: "fixed", zIndex: 9999, ...dropStyle }}
              className="rounded-xl overflow-hidden
                bg-white dark:bg-bg-panel
                border border-black/[0.07] dark:border-white/10
                shadow-[0_8px_30px_rgba(0,0,0,0.14),0_2px_6px_rgba(0,0,0,0.08)]
                dark:shadow-[0_8px_30px_rgba(0,0,0,0.55)]"
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="overflow-y-auto py-1" style={{ maxHeight: 280 }}>
                {allOptions.map((opt) => {
                  const isSelected = opt.value === value;
                  const isPlaceholderOpt = opt.value === "" && !!placeholder;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      disabled={opt.disabled}
                      onClick={() => {
                        if (!opt.disabled) { onChange(opt.value); setOpen(false); }
                      }}
                      className={[
                        "w-full text-left px-3 py-2 text-sm flex items-center justify-between gap-3 transition-colors duration-100",
                        isSelected && !isPlaceholderOpt
                          ? "text-brand dark:text-brand-glow bg-brand/[0.08] dark:bg-brand/10 font-medium"
                          : isPlaceholderOpt
                            ? "text-stone-400 dark:text-slate-500 hover:bg-black/[0.03] dark:hover:bg-bg-hover/40"
                            : "text-stone-700 dark:text-slate-300 hover:bg-black/[0.04] dark:hover:bg-bg-hover/50 hover:text-stone-900 dark:hover:text-white",
                        opt.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
                      ].join(" ")}
                    >
                      <span className="truncate">{opt.label}</span>
                      {isSelected && !isPlaceholderOpt && (
                        <Check className="w-3.5 h-3.5 shrink-0 text-brand dark:text-brand-glow" />
                      )}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
