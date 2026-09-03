/**
 * Process-wide registry for the Socket.IO server instance.
 *
 * Exists to break the app.ts → routes/chatbot.ts → index.ts → app.ts import
 * cycle: route modules need the live `io` handle for realtime fanout, but
 * importing the entrypoint from a route drags the whole server bootstrap into
 * the module graph. Services register here at startup; consumers read from
 * here instead of importing index.ts.
 */
import type { Server as SocketServer } from 'socket.io';

let io: SocketServer | null = null;

/** Register the Socket.IO server at startup (called once from index.ts). */
export function setRealtimeServer(server: SocketServer): void {
  io = server;
}

/** The registered server, or null before startup / in tests without one. */
export function getRealtimeServer(): SocketServer | null {
  return io;
}
