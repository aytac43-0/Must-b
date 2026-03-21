import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

/** Returns a singleton Socket.IO connection to the Must-b gateway */
export function getSocket(): Socket {
  if (!socket) {
    socket = io(window.location.origin, {
      transports: ["websocket", "polling"],
    });
    // Forward all agentUpdate events as window CustomEvents so any component
    // can listen without importing socket directly (v4.9)
    socket.on("agentUpdate", (data: unknown) => {
      try {
        if (data != null) {
          window.dispatchEvent(new CustomEvent("mustb:agentUpdate", { detail: data }));
        }
      } catch { /* ignore dispatch errors */ }
    });
  }
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
