import express, { Express, Request, Response } from 'express'
import { Server } from 'socket.io'
import Lobby, { LobbyStatus, LobbySettings, GameSpeed } from './lobby'
import {
  ClientToServerEvents,
  ServerToClientEvents,
  SocketData,
} from './socket-server'

const AWS = require('aws-sdk');

const dynamoDB = new AWS.DynamoDB({region: "us-east-1"});

const params = {
  TableName: 'settlers-lobbies',
};

const lobbies: Record<string, Lobby> = {};

const retrieveLobbies = (): Promise<Record<string, Lobby>> => {
  return new Promise((resolve, reject) => {
    dynamoDB.scan(params, (err, data) => {
      if (err) {
        console.error('Error retrieving items from DynamoDB:', err);
        reject(err);
      } else {
        data.Items.forEach((item) => {
          let JSONData = JSON.parse(JSON.parse(item["data-string"].S));
          lobbies[JSONData.id] = new Lobby(JSONData.id);
          Object.entries(JSONData.playerData).forEach(([key, value]) => {
            lobbies[JSONData.id].addPlayer(key, {name: value.name});
            lobbies[JSONData.id].setReadyStatus(key, value.ready);
          })
          lobbies[JSONData.id].owner = JSONData.owner;
          switch(JSONData.status) {
            case "PreGame":
              lobbies[JSONData.id].status = LobbyStatus.PreGame;
              break;
            case "InGame":
              lobbies[JSONData.id].status = LobbyStatus.InGame;
              break;
            case "PostGame":
              lobbies[JSONData.id].status = LobbyStatus.PostGame;
              break;
          }
          let settings: LobbySettings  = {isPrivate: JSONData.settings.isPrivate, hideBankCards: JSONData.settings.hideBankCards, gameSpeed: GameSpeed.Medium};
          switch(JSONData.settings.gameSpeed) {
            case "Slow":
              settings.gameSpeed = GameSpeed.Slow;
              break;
            case "Medium":
              settings.gameSpeed = GameSpeed.Medium;
              break;
            case "Fast":
              settings.gameSpeed = GameSpeed.Fast;
              break;
            case "VeryFast":
              settings.gameSpeed = GameSpeed.VeryFast;
              break;
          }

          lobbies[JSONData.id].settings = settings;
        });

        resolve(lobbies); // Pass the lobbies object to the resolve method
      }
    });
  });
};

retrieveLobbies()
  .then((lobbies) => (Object.keys(lobbies))) 
  .then((lobbyKeys) => {

    console.log(lobbies);

    const cors = require('cors')
    const http = require('http')

    AWS.config.update({region: "us-east-1"})

    const app: Express = express()
    const port = 8000

    app.use(cors())

    app.get('/', (req: Request, res: Response) => {
      res.send('hello world')
    })

    const server = http.createServer(app);
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
});
    const wsservers = lobbyKeys.map((lobbyId) => io.of(lobbyId))
    
    console.log(lobbyKeys);
    
    wsservers.forEach((wsserver) => {
      wsserver.on('connection', (socket) => {
        console.log(`socket ${socket.id} connected ${socket.nsp.name}`)
    
        const lobby = lobbies[socket.nsp.name.replace(/\//g, '')];
        if (lobby.isFull()) {
          socket.emit('lobby-is-full')
          return socket.disconnect()
        } else {
          // emit existing lobby state to newly connected client
          socket.emit('update-settings', lobby.settings)
          Object.entries(lobby.playerData).forEach(([pid, { name, ready }]) => {
            socket.emit('add-player', { pid, name, owner: lobby.owner })
            socket.emit('set-ready-status', { pid, ready })
          })
        }
    
        socket.on('add-player', ({ name }) => {
          lobby.addPlayer(socket.id, { name })
          wsserver.emit('add-player', {
            pid: socket.id,
            name: name,
            owner: lobby.owner,
          })
        })
    
        socket.on('set-ready-status', (ready: boolean) => {
          lobby.setReadyStatus(socket.id, ready)
          socket.broadcast.emit('set-ready-status', { pid: socket.id, ready: ready })
        })
    
        socket.on('chat-message', (message) => {
          socket.broadcast.emit('chat-message', {
            pid: socket.id,
            message: message,
          })
        })
    
        socket.on('update-settings', (settings) => {
          lobby.settings = settings
          socket.broadcast.emit('update-settings', settings)
        })
    
        socket.on('disconnect', () => {
          console.log('socket', socket.id, 'disconnected')
          lobby.removePlayer(socket.id)
          socket.broadcast.emit('remove-player', {
            pid: socket.id,
            owner: lobby.owner,
          })
        })
    
        socket.on('start-game', () => {
          lobby.status = LobbyStatus.InGame
          socket.broadcast.emit('start-game')
        })
      })
    })
    
    server.listen(port, () => {
      console.log(`⚡️[server]: Server is running at https://localhost:${port}`)
    })
    
    // Do something with the lobbies object
  })
  .catch((err) => {
    console.error(err);
    // Handle the error
  });



// lobby namespace

// Create a namespace for each lobby ID

