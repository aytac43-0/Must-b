/**
 * WorkspacePreview — Live Workspace File Browser (v4.3)
 *
 * Lists files inside the server's workspace/ directory and renders them:
 *   .html  → sandboxed <iframe srcdoc>
 *   .json  → syntax-highlighted <pre>
 *   .md / .txt / .js / .ts / other → plain monospace <pre>
 *
 * Endpoints used:
 *   GET /api/workspace/files        → { files: WorkspaceFile[] }
 *   GET /api/workspace/file?p=rel   → { content: string, truncated?: boolean }
 */

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen, FileText, FileCode2, Globe2,
  RefreshCw, ExternalLink, ChevronRight, AlertCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";

interface WorkspaceFile {
  name:  string;
  rel:   string;   // relative path from workspace root
  ext:   string;
  size:  number;
  mtime: string;
}

const EXT_ICON: Record<string, React.ElementType> = {
  html: Globe2,
  htm:  Globe2,
  json: FileCode2,
  js:   FileCode2,
  ts:   FileCode2,
  tsx:  FileCode2,
  jsx:  FileCode2,
};

function fmtSize(bytes: number): string {
  if (bytes < 1024)       return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string): string {
  try { return new Date(iso).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }); }
  catch { return iso; }
}

/** Minimal JSON syntax colouring via regex */
function colorJson(raw: string): string {
  return raw
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
      (match) => {
        let cls = "color:#86efac";  // number (green)
        if (/^"/.test(match)) cls = /:$/.test(match) ? "color:#93c5fd" : "color:#fca5a5"; // key=blue, str=red
        if (/true|false/.test(match)) cls = "color:#f97316";
        if (/null/.test(match)) cls = "color:#6b7280";
        return `<span style="${cls}">${match}</span>`;
      });
}

export default function WorkspacePreview() {
  const [files,    setFiles]    = useState<WorkspaceFile[]>([]);
  const [selected, setSelected] = useState<WorkspaceFile | null>(null);
  const [content,  setContent]  = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadFiles = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await apiFetch("/api/workspace/files");
      if (r.ok) {
        const d = await r.json() as { files: WorkspaceFile[] };
        setFiles(d.files ?? []);
      }
    } catch { /* silent */ }
    setRefreshing(false);
  }, []);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  const openFile = async (f: WorkspaceFile) => {
    setSelected(f);
    setContent(null);
    setError(null);
    setLoading(true);
    try {
      const r = await apiFetch(`/api/workspace/file?p=${encodeURIComponent(f.rel)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = await r.json() as { content: string; truncated?: boolean };
      setContent(d.content + (d.truncated ? "\n\n[… file truncated at 1.5 MB …]" : ""));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load file");
    }
    setLoading(false);
  };

  const FileIcon = (ext: string) => {
    const Icon = EXT_ICON[ext] ?? FileText;
    return <Icon size={12} className="shrink-0 text-gray-500" />;
  };

  const renderPreview = () => {
    if (loading) return (
      <div className="flex items-center justify-center h-full text-gray-600 text-xs gap-2">
        <RefreshCw size={14} className="animate-spin" /> Loading…
      </div>
    );
    if (error) return (
      <div className="flex items-center justify-center h-full gap-2 text-red-400 text-xs">
        <AlertCircle size={14} /> {error}
      </div>
    );
    if (!content) return (
      <div className="flex items-center justify-center h-full text-gray-700 text-xs">
        Select a file to preview
      </div>
    );

    const ext = selected?.ext ?? "";

    if (ext === "html" || ext === "htm") {
      return (
        <iframe
          srcDoc={content}
          sandbox="allow-scripts"
          className="w-full h-full border-0 bg-white"
          title="workspace-preview"
        />
      );
    }

    const rendered = ext === "json"
      ? colorJson(content)
      : content.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    return (
      <pre
        className="w-full h-full overflow-auto p-4 text-[11px] font-mono text-gray-300 leading-relaxed whitespace-pre-wrap break-words bg-transparent"
        dangerouslySetInnerHTML={{ __html: rendered }}
      />
    );
  };

  return (
    <div className="flex h-full overflow-hidden bg-[#080b12]">
      {/* ── File tree ─────────────────────────────────────────────────────── */}
      <div className="w-52 shrink-0 border-r border-white/5 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/5">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
            <FolderOpen size={11} className="text-orange-400" />
            Workspace
          </div>
          <button
            onClick={loadFiles}
            disabled={refreshing}
            className="text-gray-700 hover:text-gray-400 transition-colors"
            title="Refresh"
          >
            <RefreshCw size={11} className={refreshing ? "animate-spin" : ""} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-1 scrollbar-hide">
          {files.length === 0 ? (
            <p className="text-[10px] text-gray-700 text-center py-6">
              No files in workspace yet
            </p>
          ) : (
            files.map((f) => (
              <button
                key={f.rel}
                onClick={() => openFile(f)}
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors group ${
                  selected?.rel === f.rel
                    ? "bg-orange-500/10 text-orange-300"
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/3"
                }`}
              >
                {FileIcon(f.ext)}
                <span className="text-[11px] truncate flex-1">{f.name}</span>
                <ChevronRight
                  size={10}
                  className={`shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                    selected?.rel === f.rel ? "opacity-100 text-orange-400" : ""
                  }`}
                />
              </button>
            ))
          )}
        </div>
      </div>

      {/* ── Preview pane ──────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Preview header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-white/[0.015] shrink-0">
          <AnimatePresence mode="wait">
            {selected ? (
              <motion.div
                key={selected.rel}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 min-w-0"
              >
                <span className="text-[11px] font-mono text-gray-400 truncate">{selected.rel}</span>
                <span className="text-[9px] text-gray-700 shrink-0">
                  {fmtSize(selected.size)} · {fmtDate(selected.mtime)}
                </span>
              </motion.div>
            ) : (
              <span className="text-[11px] text-gray-700">No file selected</span>
            )}
          </AnimatePresence>

          {selected && (selected.ext === "html" || selected.ext === "htm") && (
            <button
              onClick={() => window.open(`/api/workspace/file?p=${encodeURIComponent(selected.rel)}&raw=1`, "_blank")}
              className="text-gray-600 hover:text-gray-300 transition-colors shrink-0 ml-2"
              title="Open in new tab"
            >
              <ExternalLink size={12} />
            </button>
          )}
        </div>

        {/* Preview content */}
        <div className="flex-1 overflow-hidden relative">
          {renderPreview()}
        </div>
      </div>
    </div>
  );
}
