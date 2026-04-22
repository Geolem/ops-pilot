import { Plus, Trash2 } from "lucide-react";

export interface KV {
  key: string;
  value: string;
}

export default function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = "name",
  valuePlaceholder = "value",
}: {
  rows: KV[];
  onChange: (rows: KV[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
}) {
  const update = (i: number, patch: Partial<KV>) => {
    const next = rows.slice();
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <div className="text-xs text-slate-500">暂无条目，点击下方 “添加” 新增。</div>
      )}
      {rows.map((kv, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input
            className="input font-mono text-xs flex-1"
            placeholder={keyPlaceholder}
            value={kv.key}
            onChange={(e) => update(i, { key: e.target.value })}
          />
          <input
            className="input font-mono text-xs flex-[2]"
            placeholder={valuePlaceholder}
            value={kv.value}
            onChange={(e) => update(i, { value: e.target.value })}
          />
          <button
            className="btn-ghost p-1.5 text-rose-300"
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
