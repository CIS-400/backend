export enum LobbyEvent {
  InitializePlayer = "initialize-player",
  SendMessage = "send-message",
  SetReadyStatus = "set-ready-status",
  StartGame = "start-game",
  UpdateSettings = "update-settings",
  KickPlayer = "kick-player",
}
export interface InitializePlayerPayload {
  name: string;
}
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
  number: number;
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
}
