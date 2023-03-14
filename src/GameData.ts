import Konva from "konva";
import { evaluate } from "mathjs";
import { Ant, AntState } from "./Ant";
import { Barrack } from "./Barrack";
import * as Coord from "./Coord";
import { GameConfig, TowerConfig } from "./GameConfig";
import { MapLayer } from "./MapLayer";
import { Pheromone } from "./Pheromone";
import { AttackFunc, Tower, normal, ice, aoe, pulse } from "./Tower";
import { arrayEq, coord2screen, probabilityChoose, renderConfig, twodimArray } from "./Utils";

export class GameData {
  len: number = 0;
  config: GameConfig;
  towerAttack: Map<number, AttackFunc>;

  highlandMask: boolean[][] = [];
  pheromone: [Pheromone, Pheromone];
  ants: MapLayer<Ant> = new MapLayer<Ant>();
  towers: MapLayer<Tower> = new MapLayer<Tower>();
  barracks: MapLayer<Barrack> = new MapLayer<Barrack>();

  round: number = 0;
  gold: [number, number];
  hqHp: [number, number];
  hqPos: [number, number][] = [];

  constructor(len: number, config: GameConfig, highland?: boolean[][]) {
    this.len = len;
    this.gold = [config.initGold, config.initGold];
    this.hqHp = [config.initHp, config.initHp];
    this.highlandMask = highland ?? twodimArray(2 * len - 1, () => false);
    this.pheromone = [new Pheromone(len, config.pheromone), new Pheromone(len, config.pheromone)];
    this.config = config;

    this.towerAttack = new Map<number, AttackFunc>();
    const checkOrDefault = (x: number | undefined, def: number) => {
      return x === undefined ? def : Math.max(x, def);
    };
    this.config.towers.forEach((conf) => {
      let attackType = conf.attack.type;
      let attack: AttackFunc = () => {
        console.warn(`Unknown attack mode ${conf.attack}`);
        return [];
      };
      if (attackType === "normal") {
        attack = normal(
          checkOrDefault(conf.attack.targetCount, 1),
          checkOrDefault(conf.attack.attackCount, 1)
        );
      } else if (attackType === "ice") {
        attack = ice();
      } else if (attackType === "aoe") {
        attack = aoe(checkOrDefault(conf.attack.aoeRange, 1));
      } else if (attackType === "pulse") {
        attack = pulse();
      } else {
        console.warn(`Unknown attack mode ${conf.attack}`);
      }
      this.towerAttack.set(conf.type, attack);
    });

    // TODO: Make HQ position configurable
    let hqOffset = 2;
    if (len <= 4) {
      hqOffset = 0;
    } else if (len <= 6) {
      hqOffset = 1;
    }
    this.hqPos = [
      [hqOffset, len - 1],
      [2 * len - 2 - hqOffset, len - 1],
    ];

    for (let i = 0; i <= 1; i++) {
      // TODO: Currently we set our barracks on the hq
      this.barracks.push(new Barrack(i, i, this.hqPos[i][0], this.hqPos[i][1], 0));
    }
  }

  toggleHighland(x: number, y: number) {
    if (
      Coord.isCoordValid(x, y, this.len) &&
      !arrayEq([x, y], this.hqPos[0]) &&
      !arrayEq([x, y], this.hqPos[1])
    ) {
      this.highlandMask[x][y] = !this.highlandMask[x][y];
    }
  }

  resetHighland() {
    this.highlandMask = twodimArray(2 * this.len - 1, () => false);
  }

  importHighland(imported: string): boolean {
    this.resetHighland();
    const parts = imported.split(/\s+/).filter((x) => x.length > 0);
    if (parts.length % 2 !== 0) {
      console.warn("Invalid import design");
      return false;
    }
    for (let i = 0; i < parts.length; i += 2) {
      const [x, y] = [parseInt(parts[i]), parseInt(parts[i + 1])];
      if (!isNaN(x) && !isNaN(y) && Coord.isCoordValid(x, y, this.len)) {
        this.highlandMask[x][y] = true;
      } else {
        console.warn(`Invalid coordinate [${x}, ${y}] in import design`);
      }
    }
    return true;
  }

  exportHighland(): string {
    let exported = "";
    for (let coord of Coord.inDistance(this.len - 1, this.len - 1, this.len - 1)) {
      let [x, y] = coord;
      if (this.highlandMask[x][y]) {
        exported = exported.concat(x.toString(), " ", y.toString(), "\n");
      }
    }
    return exported;
  }

  towerConfig(typeId: number): TowerConfig | undefined {
    return this.config.towers.find((tower) => tower.type === typeId);
  }

  nextLevelTower(typeId: number): [number, string][] {
    return this.config.towers
      .filter((tower) => tower.baseType === typeId)
      .map((tower) => [tower.type, tower.name]);
  }

  previousLevelTower(typeId: number): [number, string] {
    const config = this.towerConfig(typeId);
    const base = this.towerConfig(config?.baseType ?? -1);
    return base ? [base.type, base.name] : [-1, ""];
  }

  moveInformation(x: number, y: number, player: number) {
    return this.pheromone[player].moveInformation(x, y, this.highlandMask, this.hqPos[1 - player]);
  }

  nextStep(canvas: Konva.Layer | null, animationInterval: number) {
    console.log(`Round: ${this.round}`);
    let tweenList: Konva.Tween[] = [];

    this.pheromone.forEach((p) => p.onRoundBegin());

    // 1. Tower attack
    console.log("Tower attack");
    this.towers.data.forEach((tower) => {
      if (tower.cd > 0) {
        tower.cd--;
      }
      if (tower.cd === 0) {
        let attack = this.towerAttack.get(tower.config.type);
        if (attack) {
          const attacked = attack(tower, this.ants);
          if (attacked.length > 0) {
            tower.cd = tower.config.interval;
            attacked.forEach(([ant, damage]) => {
              this.pheromone[ant.player].onDamaged(ant, damage);
            });
          }
        } else {
          console.warn(`Cannot find the attack function of ${tower}`);
        }
      } else {
        console.log(`Tower ${tower.id} in cd ${tower.cd}`);
      }
    });

    // 2. Filter out dead / too-old ants
    console.log("Pre-filter ants");
    this.ants.data = this.ants.data.filter((ant) => {
      let alive = true;
      if (ant.hp <= 0) {
        console.log(`Ant ${ant.id} is dead`);
        this.pheromone[ant.player].onDead(ant);
        alive = false;
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

    // 3. Ant move
    console.log("Ant move");
    let reachedAnts: number[] = [];
    this.ants.data.forEach((ant) => {
      // Frozen check
      if (ant.state === AntState.Frozen) {
        console.log(`Ant ${ant.id} is frozen`);
        ant.state = AntState.Alive;
        return;
      }

      // Pheromone move
      let prob = this.moveInformation(ant.x, ant.y, ant.player).prob;
      if (prob.reduce((allZero, cur) => allZero && cur == 0, true)) {
        console.warn(`Ant ${ant.id} is stuck`);
        return;
      }
      let dir = probabilityChoose(prob);
      let [nx, ny] = ant.move(dir);

      // Check reached
      let reached = arrayEq([nx, ny], this.hqPos[1 - ant.player]);
      if (reached) {
        this.hqHp[1 - ant.player] -= 1;
        console.log(`HQ of player ${1 - ant.player} is attacked by ${ant.id}`);
        this.pheromone[ant.player].onReached(ant);
        reachedAnts.push(ant.id);
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
    });
    this.ants.data = this.ants.data.filter((ant) => !reachedAnts.includes(ant.id));

    // 4. Generate new ants
    console.log("Generate new ants");
    this.barracks.data.forEach((barrack) => {
      if (barrack.cd > 0) {
        barrack.cd--;
      }
      if (barrack.cd === 0) {
        const antHp = Math.floor(evaluate(this.config.antHp, { r: this.round }));
        let ant = new Ant(this.barracks.useNextIdx(), barrack.player, barrack.x, barrack.y, antHp);
        console.log(`Ant ${ant.id} is spawned at (${ant.x}, ${ant.y})`);
        this.ants.data.push(ant);
        if (canvas) {
          let [sx, sy] = coord2screen(ant.x, ant.y);
          let antShape = new Konva.Circle({
            x: sx,
            y: sy,
            radius: renderConfig.cellRadius * 0.5,
            fill: renderConfig.playerColor[ant.player],
            stroke: "#ffffff",
            strokeWidth: 2,
            opacity: 0,
            id: `ANT-${ant.id}`,
          });
          canvas.add(antShape);
          tweenList.push(
            new Konva.Tween({ node: antShape, duration: animationInterval / 1000, opacity: 1 })
          );
        }
        barrack.cd = this.config.barrackCd;
      } else {
        console.log(`Barrack ${barrack.id} in cd ${barrack.cd}`);
      }
    });

    // 5. Other stuff
    tweenList.forEach((tween) => tween.play());
    this.round += 1;
    console.log();
  }
}
