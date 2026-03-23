import { Server } from "socket.io";

let io;
const connectedUsers = new Map();

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:3000",
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;
    if (userId) connectedUsers.set(userId, socket.id);

    socket.on("disconnect", () => {
      connectedUsers.delete(userId);
    });
  });

  return io;
};

export { io, connectedUsers };