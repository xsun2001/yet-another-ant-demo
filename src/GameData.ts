import Konva from "konva";
import { evaluate } from "mathjs";
import * as Coord from "./CoordUtils";
import { GameConfig, PheromoneConfig, TowerConfig } from "./GameConfig";
import {
  arrayEq,
  genArray,
  coord2screen,
  probabilityChoose,
  renderConfig,
  twodimArray,
} from "./Utils";

enum AntState {
  Alive,
  Dead,
  Frozen,
}

export class Ant {
  id: number;
  player: number;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  state: AntState;
  path: [number, number][];

  constructor(id: number, player: number, x: number, y: number, hp: number) {
    this.id = id;
    this.player = player;
    this.x = x;
    this.y = y;
    this.hp = hp;
    this.maxHp = hp;
    this.state = AntState.Alive;
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

type AttackFunc = (tower: Tower, ants: MapLayer<Ant>) => boolean;

function findTargetAnts(tower: Tower, ants: MapLayer<Ant>): Ant[] {
  let x = tower.x,
    y = tower.y;
  let selected = ants.getByRange(x, y, tower.config.range);
  selected = selected.filter((ant) => ant.hp > 0 && ant.player !== tower.player);
  selected.sort((a, b) => {
    let disA = Coord.distance(a.x, a.y, x, y);
    let disB = Coord.distance(b.x, b.y, x, y);
    if (disA == disB) {
      return a.id - b.id;
    } else {
      return disA - disB;
    }
  });
  console.log(selected);
  return selected;
}

function damageAndLog(tower: Tower, ant: Ant, damage: number) {
  const previousHp = ant.hp;
  ant.hp -= damage;
  console.log(`Tower ${tower.id} attacks Ant ${ant.id} | HP ${previousHp} -> ${ant.hp}`);
}

function normal(targetCount: number, attackCount: number): AttackFunc {
  return (tower, ants) => {
    let attacked = false;
    for (let i = 0; i < attackCount; i++) {
      let targets = findTargetAnts(tower, ants);
      for (let j = 0; j < targetCount && j < targets.length; j++) {
        damageAndLog(tower, targets[j], tower.config.damage);
      }
      if (targets.length > 0) {
        attacked = true;
      }
    }
    return attacked;
  };
}

function ice(): AttackFunc {
  return (tower, ants) => {
    let targets = findTargetAnts(tower, ants);
    if (targets.length == 0) {
      return false;
    }
    damageAndLog(tower, targets[0], tower.config.damage);
    targets[0].state = AntState.Frozen;
    return true;
  };
}

function aoeDamageAt(
  tower: Tower,
  x: number,
  y: number,
  range: number,
  damage: number,
  ants: MapLayer<Ant>
) {
  ants.getByRange(x, y, range).forEach((ant) => damageAndLog(tower, ant, damage));
}

function aoe(damageRange: number): AttackFunc {
  return (tower, ants) => {
    let targets = findTargetAnts(tower, ants);
    if (targets.length == 0) {
      return false;
    }
    aoeDamageAt(tower, targets[0].x, targets[0].y, damageRange, tower.config.damage, ants);
    return true;
  };
}

function pulse(): AttackFunc {
  return (tower, ants) => {
    if (findTargetAnts(tower, ants).length == 0) {
      return false;
    }
    aoeDamageAt(tower, tower.x, tower.y, tower.config.range, tower.config.damage, ants);
    return true;
  };
}

export class Tower {
  id: number;
  player: number;
  x: number;
  y: number;
  config: TowerConfig;
  cd: number;
  constructor(id: number, player: number, x: number, y: number, config: TowerConfig) {
    this.id = id;
    this.player = player;
    this.x = x;
    this.y = y;
    this.config = config;
    this.cd = 0;
  }
}

export class Barrack {
  id: number;
  player: number;
  x: number;
  y: number;
  cd: number;
  constructor(id: number, player: number, x: number, y: number, cd: number) {
    this.id = id;
    this.player = player;
    this.x = x;
    this.y = y;
    this.cd = cd;
  }
}

interface IdPosData {
  id: number;
  x: number;
  y: number;
}

export class MapLayer<Data extends IdPosData> {
  data: Data[] = [];
  nextIdx: number = 0;
  getList(): Data[] {
    return this.data;
  }
  getByPredicate(pred: (data: Data) => boolean): Data[] {
    return this.data.filter(pred);
  }
  getById(id: number): Data[] {
    return this.getByPredicate((data) => data.id === id);
  }
  getByPos(x: number, y: number): Data[] {
    return this.getByPredicate((data) => data.x === x && data.y === y);
  }
  getByRange(x: number, y: number, range: number): Data[] {
    return this.data.filter((data) => Coord.distance(x, y, data.x, data.y) <= range);
  }
  push(...el: Data[]) {
    this.data.push(...el);
  }
  useNextIdx(): number {
    let idx = this.nextIdx;
    this.nextIdx += 1;
    return idx;
  }
}

export class Pheromone {
  len: number;
  value: number[][];
  config: PheromoneConfig;

  constructor(len: number, config: PheromoneConfig) {
    this.len = len;
    this.value = twodimArray(2 * len - 1, () => config.tau0);
    this.config = config;
  }

  pointModify(point: [number, number], delta: number) {
    let [x, y] = point;
    this.value[x][y] = Math.max(this.config.tauMin, this.value[x][y] + delta);
  }

  roundModify(center: [number, number], delta: number[]) {
    this.pathModify([center], delta);
  }

  pathModifyRadius(path: [number, number][], delta: number, radius: number, mask: boolean[][]) {
    for (let coord of path) {
      let [x, y] = coord;
      for (let ring of Coord.inRing(x, y, radius)) {
        let [rx, ry] = ring;
        if (Coord.isCoordValid(rx, ry, this.len) && !mask[rx][ry]) {
          mask[rx][ry] = true;
          this.pointModify([rx, ry], delta);
        }
      }
    }
  }

  pathModify(path: [number, number][], delta: number[]) {
    let mask = Array(this.len).map(() => Array(this.len).fill(false));
    for (let r = 0; r < delta.length; r++) {
      this.pathModifyRadius(path, delta[r], r, mask);
    }
  }

  globalDecay() {
    const base = this.config.tauBase;
    const rho = this.config.rho;
    this.value.forEach((row) => row.map((val) => rho * base + (1 - rho) * val));
  }

  onDamaged(ant: Ant) {}

  onDead(ant: Ant) {}

  onReached(ant: Ant) {}

  onTooOld(ant: Ant) {}

  etaTarget(x: number, y: number, dir: number, target: [number, number]): number {
    if (this.config.targetInfluenceMode === 0) {
      let [tx, ty] = target;
      let [dx, dy] = Coord.neighbor(x, y, dir);
      let distDelta = Coord.distance(tx, ty, dx, dy) - Coord.distance(tx, ty, x, y);
      if (distDelta === 1) {
        return 0.75;
      } else if (distDelta === 0) {
        return 1.0;
      } else if (distDelta === -1) {
        return 2.0;
      } else {
        console.warn(
          `Invalid distDelta. Target: [${tx}, ${ty}]. From: [${x}, ${y}]. To: [${dx}, ${dy}]`
        );
        return 0;
      }
    }
    console.warn(`Unknown targetInfluenceMode ${this.config.targetInfluenceMode}`);
    return 0;
  }

  moveInformation(
    x: number,
    y: number,
    highlandMask: boolean[][],
    target: [number, number]
  ): {
    valid: boolean[];
    tau: number[];
    eta: number[];
    prob: number[];
  } {
    let prob = genArray(6, () => 0);
    let coord = genArray(6, (dir) => Coord.neighbor(x, y, dir));
    let valid = coord.map(([x, y]) => Coord.isCoordValid(x, y, this.len) && !highlandMask[x][y]);
    let tau = coord.map(([x, y], dir) =>
      valid[dir] ? Math.pow(this.value[x][y], this.config.alpha) : 0
    );
    let eta = valid.map((valid, dir) =>
      valid ? Math.pow(this.etaTarget(x, y, dir, target), this.config.beta) : 0
    );

    if (this.config.probabilityMode === 0) {
      prob = valid.map((valid, dir) => (valid ? tau[dir] * eta[dir] : 0));
    } else if (this.config.probabilityMode === 1) {
      prob = valid.map((valid, dir) => (valid ? Math.exp(tau[dir] * eta[dir]) : 0));
    } else if (this.config.probabilityMode === 2) {
      prob = valid.map((valid, dir) => (valid ? Math.exp(tau[dir]) * eta[dir] : 0));
    } else {
    }

    let sum = prob.reduce((a, b) => a + b);
    if (sum > 0) {
      prob = prob.map((v) => v / sum);
    } else {
      console.log(`Probability of all direction of [${x}, ${y}] is equal to zero.`);
    }

    return {
      valid,
      tau,
      eta,
      prob,
    };
  }

  moveProbability(
    x: number,
    y: number,
    highlandMask: boolean[][],
    target: [number, number]
  ): number[] {
    return this.moveInformation(x, y, highlandMask, target).prob;
  }
}

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

  constructor(len: number, config: GameConfig) {
    this.len = len;
    this.gold = [config.initGold, config.initGold];
    this.hqHp = [config.initHp, config.initHp];
    this.highlandMask = twodimArray(2 * len - 1, () => false);
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
        return false;
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

    // 1. Tower attack
    console.log("Tower attack");
    this.towers.data.forEach((tower) => {
      if (tower.cd > 0) {
        tower.cd--;
      }
      if (tower.cd === 0) {
        let attack = this.towerAttack.get(tower.config.type);
        if (attack) {
          if (attack(tower, this.ants)) {
            tower.cd = tower.config.interval;
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
        this.pheromone[ant.player].onDead(ant);
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

    // 5. Fire all animations
    tweenList.forEach((tween) => tween.play());

    // 6. Other stuff
    this.round += 1;
    console.log();
  }
}
