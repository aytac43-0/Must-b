/**
 * CloudSyncButton
 *
 * Fixed bottom-right button available on setup/onboarding screens.
 * Offers two data-ingestion paths:
 *   1. "Sign In" — OAuth handshake with Must-b Worlds cloud
 *   2. "Upload Memory File" — drag-and-drop or file-picker for .md memory files
 *
 * The component manages its own expanded/collapsed state and handles the
 * file upload to POST /api/memory/import with multipart form data.
 */

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, Upload, LogIn, X, CheckCircle2, AlertCircle } from "lucide-react";

type UploadState = "idle" | "uploading" | "success" | "error";

export default function CloudSyncButton() {
  const [open, setOpen]         = useState(false);
  const [dragging, setDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadMsg, setUploadMsg]     = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Cloud Login ─────────────────────────────────────────────────────────

  const handleCloudLogin = () => {
    window.location.href = "/api/auth/cloud-connect";
  };

  // ── Memory file upload ──────────────────────────────────────────────────

  const uploadFile = async (file: File) => {
    if (!file.name.endsWith(".md") && !file.name.endsWith(".json")) {
      setUploadState("error");
      setUploadMsg("Only .md or .json files are accepted.");
      setTimeout(() => setUploadState("idle"), 3000);
      return;
    }

    setUploadState("uploading");
    setUploadMsg(`Uploading ${file.name}…`);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/memory/import", { method: "POST", body: form });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      const d = await res.json() as { ok: boolean; bytes?: number };
      setUploadState("success");
      setUploadMsg(`Memory imported${d.bytes ? ` (${(d.bytes / 1024).toFixed(1)} KB)` : ""}`);
      setTimeout(() => { setUploadState("idle"); setOpen(false); }, 2500);
    } catch (e: unknown) {
      setUploadState("error");
      setUploadMsg(e instanceof Error ? e.message : "Upload failed");
      setTimeout(() => setUploadState("idle"), 3500);
    }
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Expanded panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="w-72 bg-[#0e1117] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/8">
              <p className="text-xs font-bold text-white uppercase tracking-widest">Data Ingestion</p>
              <button
                onClick={() => setOpen(false)}
                className="text-gray-600 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Cloud login */}
              <button
                onClick={handleCloudLogin}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-orange-600/10 border border-orange-500/20 text-orange-400 hover:bg-orange-600/20 hover:border-orange-500/40 transition-all text-sm font-semibold"
              >
                <LogIn size={16} />
                <div className="text-left">
                  <p className="font-semibold">Must-b Worlds Sign In</p>
                  <p className="text-[11px] text-orange-400/60 font-normal">Sync cloud memory to this device</p>
                </div>
              </button>

              {/* File drop zone */}
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => fileRef.current?.click()}
                className={`relative cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 transition-all text-center ${
                  dragging
                    ? "border-orange-500/60 bg-orange-500/10"
                    : "border-white/10 hover:border-white/20 hover:bg-white/3"
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept=".md,.json"
                  className="hidden"
                  onChange={onFileChange}
                />
                {uploadState === "idle" && (
                  <>
                    <Upload size={20} className="mx-auto mb-2 text-gray-500" />
                    <p className="text-xs text-gray-400 font-medium">Drop memory file here</p>
                    <p className="text-[11px] text-gray-600 mt-1">.md or .json — must-b memory format</p>
                  </>
                )}
                {uploadState === "uploading" && (
                  <>
                    <span className="mx-auto mb-2 block w-5 h-5 border-2 border-orange-400/40 border-t-orange-400 rounded-full animate-spin" />
                    <p className="text-xs text-gray-400">{uploadMsg}</p>
                  </>
                )}
                {uploadState === "success" && (
                  <>
                    <CheckCircle2 size={20} className="mx-auto mb-2 text-green-400" />
                    <p className="text-xs text-green-400 font-medium">{uploadMsg}</p>
                  </>
                )}
                {uploadState === "error" && (
                  <>
                    <AlertCircle size={20} className="mx-auto mb-2 text-red-400" />
                    <p className="text-xs text-red-400 font-medium">{uploadMsg}</p>
                  </>
                )}
              </div>

              <p className="text-[10px] text-gray-700 text-center">
                All data is stored end-to-end encrypted
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Trigger button */}
      <motion.button
        onClick={() => setOpen(o => !o)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`flex items-center gap-2 px-4 py-3 rounded-2xl shadow-xl font-semibold text-sm transition-all ${
          open
            ? "bg-white/10 border border-white/15 text-white"
            : "bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-orange-500/25"
        }`}
      >
        <Cloud size={16} />
        {open ? "Close" : "Sign In / Upload"}
      </motion.button>
    </div>
  );
}
