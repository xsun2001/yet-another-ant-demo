import Konva from "konva";
import { Ant, AntState } from "./Ant";
import { inDistance } from "./Coord";
import { ConfigHandler, GameConfig } from "./GameConfig";
import { MapLayer } from "./MapLayer";
import { Pheromone } from "./Pheromone";
import { Tower } from "./Tower";
import { arrayEq, coord2screen, genArray, renderConfig, twodimArray } from "./Utils";

export enum SuperWeaponType {
  LightningStorm = 0,
  EMPBlast = 1,
  Deflectors = 2,
  EmergencyEvasion = 3,
}

export interface ActiveSuperWeapon {
  x: number;
  y: number;
  player: number;
  type: SuperWeaponType;
  remain: number;
}
export class GameData {
  len: number = 0;
  config: GameConfig;

  pheromone: [Pheromone, Pheromone];
  ants: MapLayer<Ant> = new MapLayer<Ant>();
  towers: MapLayer<Tower> = new MapLayer<Tower>();
  empRemains: number[][][];

  round: number = 0;
  gold: [number, number];
  hqHp: [number, number];
  hqPos: [number, number][] = [];
  antCdLv: [number, number] = [0, 0];
  antHpLv: [number, number] = [0, 0];
  swCd: number[][];
  activeSuperWeapon: ActiveSuperWeapon[] = [];

  constructor(len: number, config: GameConfig) {
    this.len = len;
    this.gold = [config.initGold, config.initGold];
    this.hqHp = [config.initHp, config.initHp];
    this.pheromone = [new Pheromone(len, config.pheromone), new Pheromone(len, config.pheromone)];
    this.empRemains = [twodimArray(2 * len - 1, () => 0), twodimArray(2 * len - 1, () => 0)];
    this.swCd = genArray(2, () => genArray(4, () => 0));
    this.config = config;

    const hqOffset = 2;
    this.hqPos = [
      [hqOffset, len - 1],
      [2 * len - 2 - hqOffset, len - 1],
    ];
  }

  moveInformation(x: number, y: number, player: number) {
    return this.pheromone[player].moveInformation(x, y, this.hqPos[1 - player]);
  }

  antMove(ant: Ant) {
    return this.pheromone[ant.player].moveInformation(
      ant.x,
      ant.y,
      this.hqPos[1 - ant.player],
      ant.path.length > 1 ? ant.path[ant.path.length - 2] : undefined
    );
  }

  newTowerCost(player: number) {
    return (
      ConfigHandler.config.newTowerCost *
      2 ** this.towers.getByPredicate((t) => t.player === player).length
    );
  }

  deploySuperWeapon(
    player: number,
    type: SuperWeaponType,
    x: number,
    y: number,
    canvas: Konva.Layer | null,
    animationInterval: number
  ) {
    if (this.swCd[player][type] > 0) {
      console.warn(`Super weapon ${type} in cd ${this.swCd[player][type]}`);
      return;
    }
    this.swCd[player][type] = ConfigHandler.config.superWeapon[type].cd;

    if (this.gold[player] < ConfigHandler.config.superWeapon[type].cost) {
      console.warn(`Not enough gold to deploy super weapon ${type}`);
    }
    this.gold[player] -= ConfigHandler.config.superWeapon[type].cost;

    if (type === SuperWeaponType.LightningStorm) {
      this.activeSuperWeapon.push({
        x,
        y,
        player,
        type,
        remain: 20,
      });
    } else if (type === SuperWeaponType.EMPBlast) {
      for (let coord of inDistance(x, y, 3)) {
        this.empRemains[1 - player][coord[0]][coord[1]] = 20;
      }
    } else if (type === SuperWeaponType.Deflectors) {
      this.activeSuperWeapon.push({
        x,
        y,
        player,
        type,
        remain: 20,
      });
    } else if (type === SuperWeaponType.EmergencyEvasion) {
      this.ants
        .getByRange(x, y, 3)
        .filter((a) => a.hp > 0 && a.player === player)
        .forEach((ant) => (ant.shield = 2));
    } else {
      console.warn(`Unknown super weapon type ${type}`);
    }
  }

  nextStep(canvas: Konva.Layer | null, animationInterval: number) {
    console.log(`Round: ${this.round}`);
    let tweenList: Konva.Tween[] = [];

    this.pheromone.forEach((p) => p.globalDecay());

    // 1. Lightning Storm
    console.log("Lightning storm");
    this.activeSuperWeapon
      .filter((sw) => sw.type === SuperWeaponType.LightningStorm)
      .forEach((sw) => {
        this.ants
          .getByRange(sw.x, sw.y, 3)
          .filter((ant) => ant.player !== sw.player)
          .forEach((ant) => {
            console.log(`Ant ${ant.id} HP ${ant.hp} -> ${ant.hp - 100}`);
            ant.hp -= 100;
          });
      });

    // 2. Tower attack
    console.log("Tower attack");
    this.towers.data.forEach((tower) => {
      if (this.empRemains[tower.player][tower.x][tower.y] > 0) {
        console.log(`Tower ${tower.id} in under EMP`);
        return;
      }
      if (tower.cd > 0) {
        tower.cd--;
      }
      if (tower.cd === 0) {
        const attacked = tower.attack(this.ants, this.activeSuperWeapon);
        if (attacked.length > 0) {
          tower.cd = tower.config.interval;
        }
      } else {
        console.log(`Tower ${tower.id} in cd ${tower.cd}`);
      }
    });

    // 3. Filter out dead / too-old ants
    console.log("Pre-filter ants");
    this.ants.data = this.ants.data.filter((ant) => {
      let alive = true;
      if (ant.hp <= 0) {
        console.log(`Ant ${ant.id} is dead`);
        this.pheromone[ant.player].onDead(ant);
        alive = false;
        this.gold[1 - ant.player] += (ant.lv + 1) * 3;
      } else if (ant.path.length >= this.config.antAgeLimit) {
        console.log(`Ant ${ant.id} is too old`);
        this.pheromone[ant.player].onTooOld(ant);
        alive = false;
      }

      if (!alive && canvas) {
        let antShape = canvas.findOne(`#ANT-${ant.id}`);
        if (antShape) {
          tweenList.push(
            new Konva.Tween({
              node: antShape,
              duration: animationInterval / 1000,
              opacity: 0,
              onFinish: () => {
                antShape.destroy();
              },
            })
          );
        } else {
          console.warn(`Ant ${ant.id} doesn't have a shape`);
        }
      }

      return alive;
    });

    // 4. Ant move
    console.log("Ant move");
    this.ants.data = this.ants.data.filter((ant) => {
      // Frozen check
      if (ant.state === AntState.Frozen) {
        console.log(`Ant ${ant.id} is frozen`);
        ant.state = AntState.Alive;
        return;
      }

      // Pheromone move
      let dir = this.antMove(ant).dir;
      let [nx, ny] = ant.move(dir);

      // Check reached
      let reached = arrayEq([nx, ny], this.hqPos[1 - ant.player]);
      if (reached) {
        this.hqHp[1 - ant.player] -= 1;
        console.log(`HQ of player ${1 - ant.player} is attacked by ${ant.id}`);
        this.pheromone[ant.player].onReached(ant);
      }

      // Animation
      if (canvas) {
        let antShape = canvas.findOne(`#ANT-${ant.id}`);
        if (antShape) {
          let [nsx, nsy] = coord2screen(nx, ny); // new screen x/y
          tweenList.push(
            new Konva.Tween({
              node: antShape,
              x: nsx,
              y: nsy,
              duration: animationInterval / 1000,
              onFinish: () => {
                if (reached) {
                  antShape.destroy();
                }
              },
            })
          );
        } else {
          console.warn(`Ant ${ant.id} doesn't have a shape`);
        }
      }

      return !reached;
    });

    // 5. Generate new ants
    console.log("Generate new ants");
    for (let player = 0; player < 2; player++) {
      if (this.round % this.config.antCdLv[this.antCdLv[player]] === 0) {
        let ant = new Ant(
          this.ants.useNextIdx(),
          player,
          this.hqPos[player][0],
          this.hqPos[player][1],
          this.antHpLv[player]
        );
        console.log(`Ant ${ant.id} is spawned at (${ant.x}, ${ant.y})`);
        this.ants.data.push(ant);
        if (canvas) {
          let [sx, sy] = coord2screen(ant.x, ant.y);
          let antShape = new Konva.Circle({
            x: sx,
            y: sy,
            radius: renderConfig.cellRadius * 0.5,
            fill: renderConfig.playerColor(player),
            stroke: "#FFFFFF",
            strokeWidth: 2,
            opacity: 0,
            id: `ANT-${ant.id}`,
          });
          canvas.add(antShape);
          tweenList.push(
            new Konva.Tween({ node: antShape, duration: animationInterval / 1000, opacity: 1 })
          );
        }
      }
    }

    // 6. Round UP
    tweenList.forEach((tween) => tween.play());
    for (let p = 0; p < 2; p++) {
      for (let i = 0; i < 2 * this.len - 1; i++) {
        for (let j = 0; j < 2 * this.len - 1; j++) {
          this.empRemains[p][i][j] = Math.max(0, this.empRemains[p][i][j] - 1);
        }
      }
      this.gold[p] += 1;
      for (let i = 0; i < this.swCd[p].length; i++) {
        this.swCd[p][i] = Math.max(0, this.swCd[p][i] - 1);
      }
    }
    this.activeSuperWeapon = this.activeSuperWeapon.filter((d) => (d.remain -= 1) > 0);
    this.round += 1;
  }
}
