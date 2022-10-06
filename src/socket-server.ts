import Lobby, { LobbySettings } from './lobby'

export interface ServerToClientEvents {
  'chat-message': (data: { pid: string; message: string }) => void
  'add-player': (data: { pid: string; name: string }) => void
  'set-ready-status': (data: { pid: string; ready: boolean }) => void
  'update-settings': (data: LobbySettings) => void
  'remove-player': (data: { pid: string }) => void
  'lobby-is-full': () => void
}
export interface ClientToServerEvents {
  'add-player': (data: { name: string }) => void
  'chat-message': (data: { message: string }) => void
  'set-ready-status': (ready: boolean) => void
  'update-settings': (data: LobbySettings) => void
}
export interface SocketData {
  name: string
}