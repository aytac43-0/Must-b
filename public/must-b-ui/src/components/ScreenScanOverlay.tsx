/**
 * ScreenScanOverlay — full-viewport animated warning shown while Must-b
 * captures the user's screen.  Listens for SCREEN_CAPTURE_START /
 * SCREEN_CAPTURED socket events and auto-dismisses when the capture ends.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Scan } from "lucide-react";
import { getSocket } from "@/lib/socket";

export default function ScreenScanOverlay() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    socket.on("agentUpdate", (data: { type: string }) => {
      if (data.type === "SCREEN_CAPTURE_START") setVisible(true);
      if (data.type === "SCREEN_CAPTURED" || data.type === "SCREEN_CAPTURE_END") {
        setTimeout(() => setVisible(false), 700);
      }
    });

    return () => { socket.off("agentUpdate"); };
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="scan-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[9999] pointer-events-none"
        >
          {/* Corner scan lines */}
          <div className="absolute inset-0">
            {/* Top-left */}
            <div className="absolute top-0 left-0 w-12 h-12 border-t-2 border-l-2 border-orange-500/70" />
            {/* Top-right */}
            <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-orange-500/70" />
            {/* Bottom-left */}
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-2 border-l-2 border-orange-500/70" />
            {/* Bottom-right */}
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-2 border-r-2 border-orange-500/70" />
          </div>

          {/* Horizontal scan line */}
          <motion.div
            className="absolute left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-orange-500/60 to-transparent"
            animate={{ top: ["0%", "100%"] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
          />

          {/* Status badge */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2">
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="flex items-center gap-2 px-4 py-2 bg-black/80 border border-orange-500/30 rounded-full shadow-[0_0_20px_rgba(234,88,12,0.3)] backdrop-blur-xl"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
              </span>
              <Scan size={12} className="text-orange-400 animate-spin" />
              <span className="text-orange-300 text-xs font-semibold tracking-wide">
                Scanning screen…
              </span>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
