import { useState, KeyboardEvent } from "react";
import { X, Tag as TagIcon } from "lucide-react";

export default function TagInput({
  value,
  onChange,
  placeholder = "输入后回车添加",
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const addTag = () => {
    const t = draft.trim();
    if (!t) return;
    if (value.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...value, t]);
    setDraft("");
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
    } else if (e.key === "Backspace" && !draft && value.length) {
      onChange(value.slice(0, -1));
    }
  };

  return (
    <div className="input flex items-center gap-1.5 flex-wrap min-h-[38px] cursor-text">
      <TagIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
      {value.map((t) => (
        <span
          key={t}
          className="chip bg-brand/15 text-brand-glow inline-flex items-center gap-1 animate-fade-in"
        >
          {t}
          <button
            onClick={() => onChange(value.filter((x) => x !== t))}
            className="hover:text-white"
            aria-label={`remove ${t}`}
          >
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        className="bg-transparent outline-none flex-1 min-w-[80px] text-xs"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={addTag}
        placeholder={value.length === 0 ? placeholder : ""}
      />
    </div>
  );
}
