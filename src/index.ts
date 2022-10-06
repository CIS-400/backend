import express, { Express, Request, Response } from 'express'
import { Server } from 'socket.io'
import Lobby from './lobby'
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from './socket-server'
const cors = require('cors')
const http = require('http')

const app: Express = express()
const port = 8000
const server = http.createServer(app)
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

app.use(cors())

app.get('/', (req: Request, res: Response) => {
  res.send('hello world')
})

const lobbies: Record<string, Lobby> = {
  '/dev': new Lobby('dev'),
}
// lobby namespace
const wsserver = io.of('dev') // TODO: replace dev with regex for lobby id
wsserver.on('connection', (socket) => {
  console.log(`socket ${socket.id} connected ${socket.nsp.name}`)

  const lobby = lobbies[socket.nsp.name]
  if (lobby.isFull()) {
    socket.emit('lobby-is-full')
    return socket.disconnect()
  } else {
    // emit existing lobby state to newly connected client
    socket.emit('update-settings', lobby.settings)
    Object.entries(lobby.playerData).forEach(([pid, { name, ready }]) => {
      socket.emit('add-player', { pid, name })
      socket.emit('set-ready-status', { pid, ready })
    })
  }

  socket.on('add-player', ({ name }) => {
    lobby.addPlayer(socket.id, { name })
    wsserver.emit('add-player', {
      pid: socket.id,
      name: name,
    })
  })

  socket.on('set-ready-status', (ready: boolean) => {
    lobby.setReadyStatus(socket.id, ready)
    socket.broadcast.emit('set-ready-status', { pid: socket.id, ready: ready })
  })

  socket.on('chat-message', ({ message }) => {
    socket.broadcast.emit('chat-message', {
      pid: socket.id,
      message,
    })
  })

  socket.on('update-settings', (settings) => {
    lobby.settings = settings
    socket.broadcast.emit('update-settings', settings)
  })

  socket.on('disconnect', () => {
    console.log('socket', socket.id, 'disconnected')
    lobby.removePlayer(socket.id)
    socket.broadcast.emit('remove-player', { pid: socket.id })
  })
})

server.listen(port, () => {
  console.log(`⚡️[server]: Server is running at https://localhost:${port}`)
})