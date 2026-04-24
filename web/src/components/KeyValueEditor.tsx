import { Plus, Trash2 } from "lucide-react";
import { useState, useRef, useEffect, useMemo } from "react";

export interface KV {
  key: string;
  value: string;
}

export default function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = "name",
  valuePlaceholder = "value",
  variableSuggestions = [],
}: {
  rows: KV[];
  onChange: (rows: KV[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  variableSuggestions?: string[];
}) {
  const update = (i: number, patch: Partial<KV>) => {
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="text-xs text-slate-500">暂无条目，点击下方 "添加" 新增。</div>
      )}
      {rows.map((kv, i) => (
        <div key={i} className="flex gap-2 items-start">
          <input
            className="input font-mono text-xs flex-1"
            placeholder={keyPlaceholder}
            value={kv.key}
            onChange={(e) => update(i, { key: e.target.value })}
          />
          <div className="flex-[2] relative">
            <VarInput
              value={kv.value}
              suggestions={variableSuggestions}
              onChange={(v) => update(i, { value: v })}
              placeholder={valuePlaceholder}
            />
          </div>
          <button
            className="btn-ghost p-1.5 text-rose-300 mt-0.5"
            onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        className="btn-ghost text-xs"
        onClick={() => onChange([...rows, { key: "", value: "" }])}
      >
        <Plus className="w-3 h-3" /> 添加
      </button>
    </div>
  );
}

// ─── Variable Autocomplete Input ──────────────────────────────────────────────

function VarInput({
  value,
  suggestions,
  onChange,
  placeholder,
}: {
  value: string;
  suggestions: string[];
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [filtered, setFiltered] = useState<string[]>([]);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const ref = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  // Detect cursor context: extract the partial variable name after the last `{{`
  const cursorContext = useMemo(() => {
    if (!open) return "";
    const idx = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, idx);
    const lastOpen = before.lastIndexOf("{{");
    if (lastOpen === -1) return "";
    const partial = before.slice(lastOpen + 2);
    // Stop at `}}` or whitespace
    const end = partial.search(/[\s}]/);
    return end === -1 ? partial : partial.slice(0, end);
  }, [value, open]);

  // Filter suggestions and reset highlight
  useEffect(() => {
    const ctx = cursorContext.toLowerCase();
    const f = ctx
      ? suggestions.filter((s) => s.toLowerCase().includes(ctx))
      : suggestions;
    setFiltered(f);
    setHighlightIdx(0);
  }, [cursorContext, suggestions]);

  const doInsert = (name: string) => {
    const idx = ref.current?.selectionStart ?? value.length;
    const before = value.slice(0, idx);
    const after = value.slice(idx);
    const lastOpen = before.lastIndexOf("{{");
    if (lastOpen === -1) {
      // No `{{` found — just append
      onChange(`${value}{{${name}}}`);
    } else {
      // Replace from `{{` to cursor with `{{name}}`
      const prefix = before.slice(0, lastOpen);
      onChange(`${prefix}{{${name}}}${after}`);
    }
    setOpen(false);
    ref.current?.focus();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    onChange(v);
    // Show dropdown if the text after the cursor suggests we're typing inside `{{ }}`
    const idx = e.target.selectionStart ?? v.length;
    const before = v.slice(0, idx);
    const lastOpen = before.lastIndexOf("{{");
    const lastClose = before.lastIndexOf("}}");
    if (lastOpen > lastClose && lastOpen !== -1) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || filtered.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" || e.key === "Tab") {
      if (filtered[highlightIdx]) {
        e.preventDefault();
        doInsert(filtered[highlightIdx]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative" onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150); }}>
      <input
        ref={ref}
        className="input font-mono text-xs w-full"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          // Re-evaluate on focus
          const v = e.target.value;
          const idx = e.target.selectionStart ?? v.length;
          const before = v.slice(0, idx);
          const lastOpen = before.lastIndexOf("{{");
          const lastClose = before.lastIndexOf("}}");
          if (lastOpen > lastClose && lastOpen !== -1) setOpen(true);
        }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full left-0 right-0 mt-0.5 bg-bg-elevated border border-white/10 rounded-lg shadow-lg overflow-hidden max-h-[160px] overflow-y-auto">
          {filtered.slice(0, 20).map((name, i) => (
            <button
              key={name}
              className={`w-full text-left px-3 py-1.5 text-xs font-mono flex items-center gap-2 ${
                i === highlightIdx ? "bg-brand/20 text-white" : "text-slate-300 hover:bg-white/5"
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                doInsert(name);
              }}
              onMouseEnter={() => setHighlightIdx(i)}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-brand/50 shrink-0" />
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Utility functions ────────────────────────────────────────────────────────

export function recordToRows(r: Record<string, string> | undefined | null): KV[] {
  if (!r) return [];
  return Object.entries(r).map(([key, value]) => ({ key, value }));
}

export function rowsToRecord(rows: KV[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (!r.key) continue;
    out[r.key] = r.value ?? "";
  }
  return out;
}
