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
  number: number
}
export interface LobbySettings {
  isPrivate: boolean
  hideBankCards: boolean
  gameSpeed: GameSpeed
}
export default class Lobby {
  public status: LobbyStatus = LobbyStatus.PreGame
  public id: string
  public seed: string
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
    this.seed = Math.random().toString(36).substring(2, 15)
  }

  public isFull() {
    return Object.keys(this.playerData).length === 4
  }

  public addPlayer(pid: string, data: { name: string }): PlayerData {
    if (Object.keys(this.playerData).length === 0) {
      this.owner = pid
    }
    // assign the player a number between 0 and 3 that has not already been given to another player
    const numbers = Object.values(this.playerData).map((p) => p.number)
    let number = (Math.random() * 4) << 0
    while (numbers.includes(number)) {
      number = (Math.random() * 4) << 0
    }
    this.playerData[pid] = { name: data.name, ready: false, number: number }
    return this.playerData[pid]
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

  public setName(pid: string, name: string): void {
    this.playerData[pid].name = name
  }

  public getJSON() {
    return {
      status: LobbyStatus[this.status],
      id: this.id,
      playerData: this.playerData,
      seed: this.seed,
      allowList: this.allowList,
      owner: this.owner,
      settings: {
        isPrivate: this.settings.isPrivate,
        hideBankCards: this.settings.hideBankCards,
        gameSpeed: GameSpeed[this.settings.gameSpeed],
      },
    }
  }
}
