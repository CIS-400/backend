import express, { Express, Request, Response } from "express";
import { Server } from "socket.io";
import Lobby from "./lobby";
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from "./socket-server";
const cors = require("cors");
const http = require("http");

const app: Express = express();
const port = 8000;
const server = http.createServer(app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use(cors());

app.get("/", (req: Request, res: Response) => {
  res.send("hello world");
});

const lobbies: Record<string, Lobby> = {
  "/dev": new Lobby("dev"),
};
// lobby namespace
const lobbyNamespace = io.of("dev"); // TODO: replace dev with regex for lobby id
lobbyNamespace.on("connection", (socket) => {
  console.log(`socket ${socket.id} connected ${socket.nsp.name}`);

  const lobby = lobbies[socket.nsp.name];

  if (lobby.isFull()) {
    return socket.emit("lobby-is-full");
  }

  lobby.addPlayer(socket.id, { name: socket.data.name! });

  socket.broadcast.emit("add-player", {
    pid: socket.id,
    name: socket.data.name!,
  });

  socket.on("set-ready-status", (ready: boolean) => {
    lobby.setReadyStatus(socket.id, ready);
    socket.broadcast.emit("set-ready-status", { pid: socket.id, ready: ready });
  });

  socket.on("chat-message", ({ message }) => {
    socket.broadcast.emit("chat-message", { pid: socket.id, message: message });
  });

  socket.on("disconnect", () => {
    lobby.removePlayer(socket.id);
    socket.broadcast.emit("remove-player", { pid: socket.id });
  });
});

server.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});
