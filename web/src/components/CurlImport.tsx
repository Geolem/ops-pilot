import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";
import Modal from "./Modal";
import { parseCurl, ParsedCurl } from "@/lib/curlParse";
import MethodBadge from "./MethodBadge";

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (parsed: ParsedCurl) => void;
  /** existing env baseUrls so we can try stripping prefix */
  baseUrls?: string[];
}

export default function CurlImport({ open, onClose, onImport, baseUrls = [] }: Props) {
  const [raw, setRaw] = useState("");
  const [parsed, setParsed] = useState<ParsedCurl | null>(null);
  const [error, setError] = useState<string | null>(null);

  const tryParse = () => {
    try {
      setError(null);
      const result = parseCurl(raw);
      // strip matching baseUrl prefix from URL
      for (const base of baseUrls) {
        const b = base.replace(/\/+$/, "");
        if (result.url.startsWith(b)) {
          result.url = result.url.slice(b.length) || "/";
          break;
        }
      }
      setParsed(result);
    } catch (e: any) {
      setParsed(null);
      setError(e.message);
    }
  };

  const reset = () => { setRaw(""); setParsed(null); setError(null); };

  const doImport = () => {
    if (parsed) { onImport(parsed); onClose(); reset(); }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); reset(); }} title="导入 curl 命令" width="max-w-2xl">
      <div className="space-y-3">
        <div className="text-xs text-slate-400">
          粘贴一条 curl 命令，自动解析成接口模板。支持 -X / -H / -d / --data-raw / -u / -b 等常见参数。
        </div>

        <div className="relative">
          <Terminal className="absolute left-3 top-3 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          <textarea
            className="input font-mono text-xs pl-9 min-h-[120px] resize-y"
            placeholder={"curl -X POST 'https://api.example.com/login' \\\n  -H 'Content-Type: application/json' \\\n  -d '{\"username\":\"admin\",\"password\":\"{{password}}\"}'"}
            value={raw}
            onChange={(e) => { setRaw(e.target.value); setParsed(null); setError(null); }}
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 text-xs text-rose-300 bg-rose-500/10 rounded-md px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}

        <AnimatePresence>
          {parsed && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4 space-y-2 text-xs"
            >
              <div className="flex items-center gap-2 font-medium text-sm text-slate-100">
                <MethodBadge method={parsed.method} />
                <span className="font-mono text-slate-300 truncate">{parsed.url}</span>
              </div>
              {Object.keys(parsed.headers).length > 0 && (
                <Row label="Headers">
                  {Object.entries(parsed.headers).map(([k, v]) => (
                    <div key={k} className="font-mono text-slate-400">
                      <span className="text-brand-glow">{k}</span>: {v}
                    </div>
                  ))}
                </Row>
              )}
              {Object.keys(parsed.query).length > 0 && (
                <Row label="Query">
                  {Object.entries(parsed.query).map(([k, v]) => (
                    <div key={k} className="font-mono text-slate-400">
                      <span className="text-accent">{k}</span>={v}
                    </div>
                  ))}
                </Row>
              )}
              {parsed.body && (
                <Row label={`Body (${parsed.bodyType})`}>
                  <pre className="text-slate-400 whitespace-pre-wrap break-all line-clamp-4">{parsed.body}</pre>
                </Row>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex items-center gap-2 justify-end pt-1">
          {parsed && (
            <button className="btn-ghost text-xs" onClick={reset}>
              <RotateCcw className="w-3.5 h-3.5" /> 重置
            </button>
          )}
          <button className="btn-ghost" onClick={() => { onClose(); reset(); }}>取消</button>
          {!parsed ? (
            <button className="btn-primary" disabled={!raw.trim()} onClick={tryParse}>
              <Terminal className="w-4 h-4" /> 解析
            </button>
          ) : (
            <button className="btn-primary" onClick={doImport}>
              <ArrowRight className="w-4 h-4" /> 导入为接口
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-slate-500 mb-1">{label}</div>
      <div className="bg-bg-elevated/40 rounded-md px-3 py-2 space-y-0.5">{children}</div>
    </div>
  );
}
