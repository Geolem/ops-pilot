import Editor from "@monaco-editor/react";

export default function JsonEditor({
  value,
  onChange,
  height = 200,
  language = "json",
}: {
  value: string;
  onChange: (v: string) => void;
  height?: number;
  language?: "json" | "plaintext";
}) {
  return (
    <div className="rounded-lg overflow-hidden border border-white/5">
      <Editor
        height={height}
        defaultLanguage={language}
        language={language}
        value={value}
        onChange={(v) => onChange(v ?? "")}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 12,
          tabSize: 2,
          wordWrap: "on",
          scrollBeyondLastLine: false,
          lineNumbersMinChars: 3,
          automaticLayout: true,
          padding: { top: 8 },
        }}
      />
    </div>
  );
}
