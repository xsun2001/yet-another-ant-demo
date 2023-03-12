import Konva from "konva";
import * as Coord from "./CoordUtils";
import { GameConfig, PheromoneConfig, TowerConfig } from "./GameConfig";
import { arrayEq, genArray, idx2pos, probabilityChoose, renderConfig, twodimArray } from "./Utils";

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
  state: AntState;
  path: [number, number][];

  constructor(id: number, player: number, x: number, y: number, hp: number) {
    this.id = id;
    this.player = player;
    this.x = x;
    this.y = y;
    this.hp = hp;
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
  selected = selected.filter((ant) => ant.hp > 0 && ant.player != tower.player);
  selected.sort((a, b) => {
    let disA = Coord.distance(a.x, a.y, x, y);
    let disB = Coord.distance(b.x, b.y, x, y);
    if (disA == disB) {
      return a.id - b.id;
    } else {
      return disA - disB;
    }
  });
  return selected;
}

function normal(targetCount: number, attackCount: number): AttackFunc {
  return (tower, ants) => {
    let attacked = false;
    for (let i = 0; i < attackCount; i++) {
      let targets = findTargetAnts(tower, ants);
      for (let j = 0; j < targetCount && j < targets.length; j++) {
        targets[j].hp -= tower.config.damage;
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
    targets[0].hp -= tower.config.damage;
    targets[0].state = AntState.Frozen;
    return true;
  };
}

function aoeDamageAt(x: number, y: number, range: number, damage: number, ants: MapLayer<Ant>) {
  ants.getByRange(x, y, range).forEach((ant) => (ant.hp -= damage));
}

function aoe(damageRange: number): AttackFunc {
  return (tower, ants) => {
    let targets = findTargetAnts(tower, ants);
    if (targets.length == 0) {
      return false;
    }
    aoeDamageAt(targets[0].x, targets[0].y, damageRange, tower.config.damage, ants);
    return true;
  };
}

function pulse(): AttackFunc {
  return (tower, ants) => {
    if (findTargetAnts(tower, ants).length == 0) {
      return false;
    }
    aoeDamageAt(tower.x, tower.y, tower.config.range, tower.config.damage, ants);
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
  getByPredicate(Predicate: (data: Data) => boolean): Data | undefined {
    return this.data.find(Predicate);
  }
  getById(id: number): Data | undefined {
    return this.getByPredicate((data) => data.id === id);
  }
  getByPos(x: number, y: number): Data | undefined {
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
        if (Coord.isIdxValid(rx, ry, this.len) && !mask[rx][ry]) {
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

  etaTarget(ant: Ant, dir: number, target: [number, number]): number {
    if (this.config.targetInfluenceMode === 0) {
      let [tx, ty] = target;
      let [x, y] = [ant.x, ant.y];
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
          `Invalid distDelta. Target: [${tx}, ${ty}]. Ant: [${x}, ${y}]. Dir: [${dx}, ${dy}]`
        );
        return 0;
      }
    }
    console.warn(`Unknown targetInfluenceMode ${this.config.targetInfluenceMode}`);
    return 0;
  }

  moveProbability(ant: Ant, highlandMask: boolean[][], target: [number, number]): number[] {
    let prob = genArray(6, () => 0);
    let coord = genArray(6, (dir) => Coord.neighbor(ant.x, ant.y, dir));
    let valid = coord.map(([x, y]) => Coord.isIdxValid(x, y, this.len) && !highlandMask[x][y]);
    let tau = coord.map(([x, y], dir) =>
      valid[dir] ? Math.pow(this.value[x][y], this.config.alpha) : 0
    );
    let eta = valid.map((valid, dir) =>
      valid ? Math.pow(this.etaTarget(ant, dir, target), this.config.beta) : 0
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
      console.log(`Probability of all direction is equal to zero. ${ant.id}`);
    }

    return prob;
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
          checkOrDefault(conf.attack.attackCount, 1),
          checkOrDefault(conf.attack.targetCount, 1)
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
      this.towerAttack.set(conf.id, attack);
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

  nextStep(canvas: Konva.Layer | null = null) {
    let tweenList: Konva.Tween[] = [];

    // 1. Tower attack
    console.log("Tower attack");
    this.towers.data.forEach((tower) => {
      console.log(tower);
      if (tower.cd > 0) {
        tower.cd--;
      }
      if (tower.cd == 0) {
        let attack = this.towerAttack.get(tower.config.id);
        if (attack) {
          if (attack(tower, this.ants)) {
            tower.cd = tower.config.interval;
          }
        } else {
          console.warn(`Cannot find the attack function of ${tower}`);
        }
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
              duration: 0.5,
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
    this.ants.data.forEach((ant) => {
      // Frozen check
      if (ant.state === AntState.Frozen) {
        console.log(`Ant ${ant.id} is frozen`);
        ant.state = AntState.Alive;
        return;
      }

      // Pheromone move
      let prob = this.pheromone[ant.player].moveProbability(
        ant,
        this.highlandMask,
        this.hqPos[1 - ant.player]
      );
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
      }

      // Animation
      if (canvas) {
        let antShape = canvas.findOne(`#ANT-${ant.id}`);
        if (antShape) {
          let [nsx, nsy] = idx2pos(nx, ny); // new screen x/y
          tweenList.push(
            new Konva.Tween({
              node: antShape,
              x: nsx,
              y: nsy,
              duration: 0.5,
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

    // 4. Generate new ants
    console.log("Generate new ants");
    this.barracks.data.forEach((barrack) => {
      if (barrack.cd > 0) {
        barrack.cd--;
      }
      if (barrack.cd === 0) {
        let ant = new Ant(this.barracks.useNextIdx(), barrack.player, barrack.x, barrack.y, 10);
        this.ants.data.push(ant);
        if (canvas) {
          let [sx, sy] = idx2pos(ant.x, ant.y);
          let antShape = new Konva.Circle({
            x: sx,
            y: sy,
            radius: renderConfig.cellRadius * 0.5,
            fill: ant.player ? "blue" : "red",
            stroke: "#ffffff",
            strokeWidth: 2,
            opacity: 0,
            id: `ANT-${ant.id}`,
          });
          canvas.add(antShape);
          tweenList.push(new Konva.Tween({ node: antShape, duration: 0.5, opacity: 1 }));
        }
        barrack.cd = this.config.barrackCd;
      }
    });

    // 5. Fire all animations
    tweenList.forEach((tween) => tween.play());

    // 6. Other stuff
    this.round += 1;
  }
}
