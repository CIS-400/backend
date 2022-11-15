export enum LobbyStatus {
  PreGame,
  InGame,
  PostGame,
}
export enum GameSpeed {
  Slow,
  Medium,
  Fast,
  VeryFast,
}
export interface PlayerData {
  name: string
  ready: boolean
}
export interface LobbySettings {
  isPrivate: boolean
  hideBankCards: boolean
  gameSpeed: GameSpeed
}
export default class Lobby {
  public status: LobbyStatus = LobbyStatus.PreGame
  public id: string
  // map of socket ids to player data in the lobby context
  public playerData: Record<string, PlayerData>
  public owner: string | undefined
  // list of cookies that allow a connection into the lobby. only used once the game has started.
  public allowList: string[] = []
  public settings: LobbySettings = {
    isPrivate: false,
    hideBankCards: false,
    gameSpeed: GameSpeed.Medium,
  }

  constructor(id: string) {
    this.id = id
    this.playerData = {}
  }

  public isFull() {
    return Object.keys(this.playerData).length === 4
  }

  public addPlayer(pid: string, data: { name: string }): void {
    if (Object.keys(this.playerData).length === 0) {
      this.owner = pid
    }
    this.playerData[pid] = { name: data.name, ready: false }
  }

  public removePlayer(pid: string): void {
    if (this.playerData[pid] !== undefined) {
      delete this.playerData[pid]
    }
    if (pid === this.owner) {
      const pids = Object.keys(this.playerData)
      this.owner =
        pids.length > 0 ? pids[(pids.length * Math.random()) << 0] : undefined
    }
  }

  public setReadyStatus(pid: string, ready: boolean): void {
    this.playerData[pid].ready = ready
  }
}
