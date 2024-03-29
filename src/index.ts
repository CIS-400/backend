import express, { Express, Request, Response } from 'express'
import { Server } from 'socket.io'
import Lobby, { LobbyStatus, LobbySettings, GameSpeed } from './lobby'
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from './socket-server'

const AWS = require('aws-sdk')

const dynamoDB = new AWS.DynamoDB({ region: 'us-east-1' })

const params = {
  TableName: 'settlers-lobbies',
}

const lobbies: Record<string, Lobby> = {}

const retrieveLobbies = (): Promise<Record<string, Lobby>> => {
  return new Promise((resolve, reject) => {
    dynamoDB.scan(params, (err, data) => {
      if (err) {
        console.error('Error retrieving items from DynamoDB:', err)
        reject(err)
      } else {
        data.Items.forEach((item) => {
          let JSONData = JSON.parse(item['data-string'].S)
          lobbies[JSONData.id] = new Lobby(JSONData.id)
          Object.entries(JSONData.playerData).forEach(([key, value]) => {
            lobbies[JSONData.id].addPlayer(key, { name: value.name })
            lobbies[JSONData.id].setReadyStatus(key, value.ready)
          })
          lobbies[JSONData.id].seed = JSONData.seed
          lobbies[JSONData.id].owner = JSONData.owner
          switch (JSONData.status) {
            case 'PreGame':
              lobbies[JSONData.id].status = LobbyStatus.PreGame
              break
            case 'InGame':
              lobbies[JSONData.id].status = LobbyStatus.InGame
              break
            case 'PostGame':
              lobbies[JSONData.id].status = LobbyStatus.PostGame
              break
          }
          let settings: LobbySettings = {
            isPrivate: JSONData.settings.isPrivate,
            hideBankCards: JSONData.settings.hideBankCards,
            gameSpeed: GameSpeed.Medium,
          }
          switch (JSONData.settings.gameSpeed) {
            case 'Slow':
              settings.gameSpeed = GameSpeed.Slow
              break
            case 'Medium':
              settings.gameSpeed = GameSpeed.Medium
              break
            case 'Fast':
              settings.gameSpeed = GameSpeed.Fast
              break
            case 'VeryFast':
              settings.gameSpeed = GameSpeed.VeryFast
              break
          }

          lobbies[JSONData.id].settings = settings
        })

        resolve(lobbies) // Pass the lobbies object to the resolve method
      }
    })
  })
}

retrieveLobbies()
  .then((lobbies) => Object.keys(lobbies))
  .then((lobbyKeys) => {
    console.log(lobbies)

    const cors = require('cors')
    const http = require('http')

    AWS.config.update({ region: 'us-east-1' })

    const app: Express = express()
    const port = 8000

    app.use(express.json())

    app.use(
      cors({
        origin: 'http://34.227.103.138:3000', // Replace with your actual frontend domain
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type'],
      }),
    )

    const updateLobbyInDB = (id: string, data: string): Promise<void> => {
      console.log(id, data)
      return new Promise((resolve, reject) => {
        const updateParams = {
          TableName: 'settlers-lobbies',
          Key: {
            'lobby-id': { S: id },
          },
          UpdateExpression: 'set #data_string = :data',
          ExpressionAttributeNames: {
            '#data_string': 'data-string',
          },
          ExpressionAttributeValues: {
            ':data': { S: data },
          },
        }

        dynamoDB.updateItem(updateParams, (err: Error) => {
          if (err) {
            console.error('Error updating item in DynamoDB:', err)
            reject(err)
          } else {
            resolve()
          }
        })
      })
    }

    app.get('/', (req: Request, res: Response) => {
      res.send('hello world')
    })

    app.post('/api/create-lobby', (req: Request, res: Response) => {
      const { id, status, settings, playerData } = req.body

      const newLobby = io.of(id)

      lobbies[id] = new Lobby(id)
      Object.entries(playerData).forEach(([key, value]) => {
        lobbies[id].addPlayer(key, { name: value.name })
        lobbies[id].setReadyStatus(key, value.ready)
      })
      switch (status) {
        case 'PreGame':
          lobbies[id].status = LobbyStatus.PreGame
          break
        case 'InGame':
          lobbies[id].status = LobbyStatus.InGame
          break
        case 'PostGame':
          lobbies[id].status = LobbyStatus.PostGame
          break
      }
      let newsettings: LobbySettings = {
        isPrivate: settings.isPrivate,
        hideBankCards: settings.hideBankCards,
        gameSpeed: GameSpeed.Medium,
      }
      switch (settings.gameSpeed) {
        case 'Slow':
          newsettings.gameSpeed = GameSpeed.Slow
          break
        case 'Medium':
          newsettings.gameSpeed = GameSpeed.Medium
          break
        case 'Fast':
          newsettings.gameSpeed = GameSpeed.Fast
          break
        case 'VeryFast':
          newsettings.gameSpeed = GameSpeed.VeryFast
          break
      }

      lobbies[id].settings = settings
      newLobby.on('connection', (socket) => {
        console.log(`socket ${socket.id} connected ${socket.nsp.name}`)

        const lobby = lobbies[socket.nsp.name.replace(/\//g, '')]
        if (
          lobby.isFull() ||
          (lobby.status !== LobbyStatus.PreGame &&
            !lobby.allowList.includes(
              socket.handshake.headers['allow-list-id'] as string,
            ))
        ) {
          console.log('could not join!')
          socket.emit('lobby-is-full')
          return socket.disconnect()
        } else {
          // emit existing lobby state to newly connected client
          socket.emit('update-settings', lobby.settings)
          socket.emit('set-seed', lobby.seed)
          Object.entries(lobby.playerData).forEach(
            ([pid, { name, ready, number }]) => {
              socket.emit('add-player', {
                pid,
                name,
                owner: lobby.owner,
                number,
              })
              socket.emit('set-ready-status', { pid, ready })
            },
          )
        }

        socket.on('add-player', ({ name }) => {
          const player = lobby.addPlayer(socket.id, { name })
          newLobby.emit('add-player', {
            pid: socket.id,
            name: name,
            owner: lobby.owner,
            number: player.number,
          })

          updateLobbyInDB(
            socket.nsp.name.replace(/\//g, ''),
            JSON.stringify(lobby.getJSON()),
          ) // Update DynamoDB
        })

        socket.on('set-ready-status', (ready: boolean) => {
          lobby.setReadyStatus(socket.id, ready)
          socket.broadcast.emit('set-ready-status', {
            pid: socket.id,
            ready: ready,
          })

          updateLobbyInDB(
            socket.nsp.name.replace(/\//g, ''),
            JSON.stringify(lobby.getJSON()),
          ) // Update DynamoDB
        })

        socket.on('set-name', (name: string) => {
          lobby.setName(socket.id, name)
          socket.broadcast.emit('set-name', { pid: socket.id, name: name })

          updateLobbyInDB(
            socket.nsp.name.replace(/\//g, ''),
            JSON.stringify(lobby.getJSON()),
          ) // Update DynamoDB
        })

        socket.on('chat-message', (message) => {
          socket.broadcast.emit('chat-message', {
            pid: socket.id,
            message: message,
          })

          updateLobbyInDB(
            socket.nsp.name.replace(/\//g, ''),
            JSON.stringify(lobby.getJSON()),
          ) // Update DynamoDB
        })

        socket.on('update-settings', (settings) => {
          lobby.settings = settings
          socket.broadcast.emit('update-settings', settings)

          updateLobbyInDB(
            socket.nsp.name.replace(/\//g, ''),
            JSON.stringify(lobby.getJSON()),
          ) // Update DynamoDB
        })

        socket.on('disconnect', () => {
          console.log('socket', socket.id, 'disconnected')
          lobby.removePlayer(socket.id)
          socket.broadcast.emit('remove-player', {
            pid: socket.id,
            owner: lobby.owner,
          })

          updateLobbyInDB(
            socket.nsp.name.replace(/\//g, ''),
            JSON.stringify(lobby.getJSON()),
          ) // Update DynamoDB
        })

        socket.on('start-game', async () => {
          lobby.status = LobbyStatus.InGame
          lobby.allowList = [...(await newLobby.allSockets())]
          socket.broadcast.emit('start-game')

          updateLobbyInDB(
            socket.nsp.name.replace(/\//g, ''),
            JSON.stringify(lobby.getJSON()),
          ) // Update DynamoDB
        })

        socket.on('action', (action) => {
          console.log('socket', socket.id, 'action', action)
          socket.broadcast.emit('get-action', action)
        })
      })

      // Return a JSON response with a success message
      res.json({ message: `Lobby ${id} created successfully` })
    })

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

    const wsservers = lobbyKeys.map((lobbyId) => io.of(lobbyId))

    console.log(lobbyKeys)

    wsservers.forEach((wsserver) => {
      wsserver.on('connection', (socket) => {
        console.log(`socket ${socket.id} connected ${socket.nsp.name}`)

        const lobby = lobbies[socket.nsp.name.replace(/\//g, '')]
        if (
          lobby.isFull() ||
          (lobby.status !== LobbyStatus.PreGame &&
            !lobby.allowList.includes(
              socket.handshake.headers['allow-list-id'] as string,
            ))
        ) {
          console.log('could not join!')
          socket.emit('lobby-is-full')
          return socket.disconnect()
        } else {
          // emit existing lobby state to newly connected client
          socket.emit('update-settings', lobby.settings)
          socket.emit('set-seed', lobby.seed)
          Object.entries(lobby.playerData).forEach(
            ([pid, { name, ready, number }]) => {
              socket.emit('add-player', {
                pid,
                name,
                owner: lobby.owner,
                number,
              })
              socket.emit('set-ready-status', { pid, ready })
            },
          )
        }

        socket.on('add-player', ({ name }) => {
          const player = lobby.addPlayer(socket.id, { name })
          wsserver.emit('add-player', {
            pid: socket.id,
            name: name,
            owner: lobby.owner,
            number: player.number,
          })

          updateLobbyInDB(
            socket.nsp.name.replace(/\//g, ''),
            JSON.stringify(lobby.getJSON()),
          ) // Update DynamoDB
        })

        socket.on('set-ready-status', (ready: boolean) => {
          lobby.setReadyStatus(socket.id, ready)
          socket.broadcast.emit('set-ready-status', {
            pid: socket.id,
            ready: ready,
          })

          updateLobbyInDB(
            socket.nsp.name.replace(/\//g, ''),
            JSON.stringify(lobby.getJSON()),
          ) // Update DynamoDB
        })

        socket.on('set-name', (name: string) => {
          lobby.setName(socket.id, name)
          socket.broadcast.emit('set-name', { pid: socket.id, name: name })

          updateLobbyInDB(
            socket.nsp.name.replace(/\//g, ''),
            JSON.stringify(lobby.getJSON()),
          ) // Update DynamoDB
        })

        socket.on('chat-message', (message) => {
          socket.broadcast.emit('chat-message', {
            pid: socket.id,
            message: message,
          })

          updateLobbyInDB(
            socket.nsp.name.replace(/\//g, ''),
            JSON.stringify(lobby.getJSON()),
          ) // Update DynamoDB
        })

        socket.on('update-settings', (settings) => {
          lobby.settings = settings
          socket.broadcast.emit('update-settings', settings)

          updateLobbyInDB(
            socket.nsp.name.replace(/\//g, ''),
            JSON.stringify(lobby.getJSON()),
          ) // Update DynamoDB
        })

        socket.on('disconnect', () => {
          console.log('socket', socket.id, 'disconnected')
          lobby.removePlayer(socket.id)
          socket.broadcast.emit('remove-player', {
            pid: socket.id,
            owner: lobby.owner,
          })

          updateLobbyInDB(
            socket.nsp.name.replace(/\//g, ''),
            JSON.stringify(lobby.getJSON()),
          ) // Update DynamoDB
        })

        socket.on('start-game', async () => {
          lobby.status = LobbyStatus.InGame
          lobby.allowList = [...(await wsserver.allSockets())]
          socket.broadcast.emit('start-game')

          updateLobbyInDB(
            socket.nsp.name.replace(/\//g, ''),
            JSON.stringify(lobby.getJSON()),
          ) // Update DynamoDB
        })

        socket.on('action', (action) => {
          console.log('socket', socket.id, 'action', action)
          socket.broadcast.emit('get-action', action)
        })
      })
    })

    server.listen(port, "0.0.0.0", () => {
      console.log(`⚡️[server]: Server is running at https://34.227.103.138:${port}`)
    })

    // Do something with the lobbies object
  })
  .catch((err) => {
    console.error(err)
    // Handle the error
  })

// lobby namespace

// Create a namespace for each lobby ID
