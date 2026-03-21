/**
 * LiveSightPanel — shows what Must-b is "seeing" in real time.
 *
 * Listens for SCREEN_CAPTURED socket events and renders a live thumbnail
 * of the captured screen with detected UI elements overlaid as boxes.
 * Placed in the Dashboard's ActiveWorkflow area (War Room center column).
 */
import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Scan } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { apiFetch } from "@/lib/api";

interface UIElement {
  type:       "button" | "input" | "image" | "unknown";
  x:          number;
  y:          number;
  width:      number;
  height:     number;
  confidence: number;
}

interface CapturePayload {
  base64:   string;
  width:    number;
  height:   number;
  source:   string;
  elements?: UIElement[];
}

interface GuidancePayload {
  warn:    boolean;
  message: string | null;
  model:   string;
}

const TYPE_COLOR: Record<string, string> = {
  button:  "rgba(234,88,12,0.7)",
  input:   "rgba(59,130,246,0.7)",
  image:   "rgba(168,85,247,0.6)",
  unknown: "rgba(255,255,255,0.3)",
};

export default function LiveSightPanel() {
  const [scanning,  setScanning]  = useState(false);
  const [capture,   setCapture]   = useState<CapturePayload | null>(null);
  const [guidance,  setGuidance]  = useState<string | null>(null);
  const [expanded,  setExpanded]  = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw thumbnail + detected element overlays onto canvas
  useEffect(() => {
    if (!capture || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    if (!ctx) return;

    const img  = new Image();
    img.onload = () => {
      canvas.width  = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Overlay detected elements
      if (capture.elements?.length) {
        for (const el of capture.elements) {
          ctx.strokeStyle = TYPE_COLOR[el.type] ?? TYPE_COLOR.unknown;
          ctx.lineWidth   = Math.max(2, Math.round(img.width / 400));
          ctx.strokeRect(el.x, el.y, el.width, el.height);

          // Label
          ctx.fillStyle  = TYPE_COLOR[el.type] ?? TYPE_COLOR.unknown;
          ctx.font       = `${Math.max(10, Math.round(img.width / 120))}px monospace`;
          ctx.fillText(el.type, el.x + 4, el.y + 14);
        }
      }
    };
    img.src = `data:image/png;base64,${capture.base64}`;
  }, [capture]);

  // Socket listeners
  useEffect(() => {
    const socket = getSocket();

    socket.on("agentUpdate", (data: { type: string } & Record<string, unknown>) => {
      if (data.type === "SCREEN_CAPTURE_START") {
        setScanning(true);
      } else if (data.type === "SCREEN_CAPTURED") {
        setScanning(false);
        setCapture({
          base64:   data.base64 as string,
          width:    data.width  as number,
          height:   data.height as number,
          source:   data.source as string,
          elements: data.elements as UIElement[] | undefined,
        });
      }
    });

    return () => { socket.off("agentUpdate"); };
  }, []);

  const handleCapture = async () => {
    if (scanning) return;

    // Check model guidance before capturing
    try {
      const r = await apiFetch("/api/system/vision-guidance");
      if (r.ok) {
        const g = await r.json() as GuidancePayload;
        if (g.warn && g.message) setGuidance(g.message);
      }
    } catch { /* silent */ }

    // Trigger screen capture (detect=true → element detection)
    await apiFetch("/api/system/screenshot", {
      method: "POST",
      body:   JSON.stringify({ detect: true }),
    }).catch(() => {});
  };

  return (
    <div className="border border-white/5 rounded-2xl bg-[#0a0d16]/60 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Eye size={14} className="text-orange-400" />
          <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">Live Sight</span>
          {capture && (
            <span className="text-[10px] text-gray-600 font-mono">
              {capture.width}×{capture.height} · {capture.source}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {capture && (
            <button
              onClick={() => setExpanded(v => !v)}
              className="text-gray-600 hover:text-gray-300 transition-colors"
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <EyeOff size={13} /> : <Eye size={13} />}
            </button>
          )}
          <button
            onClick={handleCapture}
            disabled={scanning}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-all ${
              scanning
                ? "text-orange-400 bg-orange-500/10 animate-pulse cursor-not-allowed"
                : "text-gray-500 hover:text-orange-400 hover:bg-orange-500/10 border border-white/5"
            }`}
          >
            <Scan size={11} />
            {scanning ? "Scanning…" : "Capture"}
          </button>
        </div>
      </div>

      {/* Model guidance warning */}
      <AnimatePresence>
        {guidance && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="px-4 py-3 bg-amber-500/8 border-b border-amber-500/15"
          >
            <p className="text-[11px] text-amber-400 leading-relaxed">{guidance}</p>
            <button
              onClick={() => setGuidance(null)}
              className="text-[10px] text-amber-600 hover:text-amber-400 mt-1 transition-colors"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thumbnail */}
      <AnimatePresence>
        {capture && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`relative overflow-hidden transition-all duration-300 ${
              expanded ? "max-h-[500px]" : "max-h-[140px]"
            }`}
          >
            <canvas
              ref={canvasRef}
              className="w-full object-contain"
              style={{ imageRendering: "auto" }}
            />
            {/* Element count badge */}
            {capture.elements && capture.elements.length > 0 && (
              <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/70 rounded-md text-[10px] font-mono text-orange-400 border border-orange-500/20">
                {capture.elements.length} elements
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!capture && !scanning && (
        <div className="flex items-center justify-center py-8 text-gray-700 text-xs">
          Press Capture to see what Must-b sees
        </div>
      )}

      {/* Scanning animation */}
      {scanning && (
        <div className="flex items-center justify-center gap-2 py-8 text-orange-400 text-xs animate-pulse">
          <Scan size={14} className="animate-spin" />
          Scanning screen…
        </div>
      )}
    </div>
  );
}
