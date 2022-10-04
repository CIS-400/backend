enum LobbyStatus {
  PreGame,
  InGame,
  PostGame,
}
enum GameSpeed {
  Slow,
  Medium,
  Fast,
  VeryFast,
}
interface PlayerData {
  name: string;
  ready: boolean;
}
export default class Lobby {
  public status: LobbyStatus = LobbyStatus.PreGame;
  public id: string;
  // map of socket ids to player data in the lobby context
  public playerData: Record<string, PlayerData>;
  // settings
  public isPrivate: boolean = false;
  public hideBankCards: boolean = false;
  public gameSpeed: GameSpeed = GameSpeed.Medium;

  constructor(id: string) {
    this.id = id;
    this.playerData = {};
  }

  public isFull() {
    return Object.keys(this.playerData).length === 4;
  }

  public addPlayer(pid: string, data: { name: string }): void {
    this.playerData[pid] = { name: data.name, ready: false };
  }

  public removePlayer(pid: string): void {
    if (this.playerData[pid] !== undefined) {
      delete this.playerData[pid];
    }
  }

  public setReadyStatus(pid: string, ready: boolean): void {
    this.playerData[pid].ready = ready;
  }
}
