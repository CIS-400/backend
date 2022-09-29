import express, { Express, Request, Response } from "express";
import { Socket } from "socket.io";
import Lobby, { InitializePlayerPayload, LobbyEvent } from "./lobby";
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");

const app: Express = express();
const port = 8000;
const server = http.createServer(app);
const io = new Server(server, {
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
  dev: new Lobby("dev"),
};
// lobby namespace
const lobbyNamespace = io.of("dev"); // TODO replace dev with regex for lobby id
lobbyNamespace.on("connection", (socket: any) => {
  console.log(`socket ${socket.id} connected`);

  // register all socket events
  const lobby = lobbies[socket.nsp];

  socket.on(
    LobbyEvent.InitializePlayer,
    (payload: InitializePlayerPayload) => {}
  );
});

server.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`);
});
