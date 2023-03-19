import { ConfigHandler } from "./GameConfig";
import * as Coord from "./Coord";

export enum AntState {
  Alive,
  Dead,
  Frozen,
}

export class Ant {
  id: number;
  player: number;
  x: number;
  y: number;
  lv: number;
  hp: number;
  maxHp: number;
  state: AntState;
  shield: number;
  path: [number, number][];

  constructor(id: number, player: number, x: number, y: number, lv: number) {
    this.id = id;
    this.player = player;
    this.x = x;
    this.y = y;
    this.lv = lv;
    this.maxHp = this.hp = ConfigHandler.config.antHpLv[lv];
    this.state = AntState.Alive;
    this.shield = 0;
    this.path = [[x, y]];
  }

  move(dir: number): [number, number] {
    let [nx, ny] = Coord.neighbor(this.x, this.y, dir);
    console.log(`Ant ${this.id} dir ${dir} [${this.x}, ${this.y}] -> [${nx}, ${ny}]`);
    this.x = nx;
    this.y = ny;
    this.path.push([nx, ny]);
    return [nx, ny];
  }
}
