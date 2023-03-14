import { evaluate } from "mathjs";
import { PheromoneConfig } from "./GameConfig";
import { twodimArray, genArray } from "./Utils";
import * as Coord from "./Coord";
import { Ant } from "./Ant";

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

  roundModify(center: [number, number], delta: number, lambda: number[] = [1]) {
    this.pathModify([center], delta, lambda);
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

  pathModify(path: [number, number][], delta: number, lambda: number[] = [1]) {
    let mask = twodimArray(2 * this.len - 1, () => false);
    for (let r = 0; r < lambda.length; r++) {
      this.pathModifyRadius(path, delta * lambda[r], r, mask);
    }
  }

  globalDecay() {
    const base = this.config.tauBase;
    const rho = this.config.rho;
    for (let i = 0; i < 2 * this.len - 1; i++) {
      for (let j = 0; j < 2 * this.len - 1; j++) {
        this.value[i][j] = rho * this.value[i][j] + (1 - rho) * base;
      }
    }
  }

  onRoundBegin() {
    if (this.config.globalDecayMode === 0) {
      this.globalDecay();
    }
  }

  onDamaged(ant: Ant, damage: number) {
    const deltaTau = evaluate(this.config.tauOnDamaged, {
      damage,
      age: ant.path.length,
      maxhp: ant.maxHp,
    });
    if (this.config.onDamagedMode === 0) {
    } else {
      console.warn(`Unknown onDamagedMode: ${this.config.onDamagedMode}`);
    }
  }

  onDead(ant: Ant) {
    const deltaTau = evaluate(this.config.tauOnDead, { age: ant.path.length, maxhp: ant.maxHp });
    if (this.config.onDeadMode === 0) {
      this.roundModify([ant.x, ant.y], deltaTau, [1, 0.5]);
    } else {
      console.warn(`Unknown onDeadMode: ${this.config.onDeadMode}`);
    }
  }

  onReached(ant: Ant) {
    const deltaTau = evaluate(this.config.tauOnReached, {
      age: ant.path.length,
      hp: ant.hp,
      maxhp: ant.maxHp,
    });
    if (this.config.onReachedMode === 0) {
      this.pathModify(ant.path, deltaTau, [1, 0.5]);
    } else {
      console.warn(`Unknown onReachedMode: ${this.config.onReachedMode}`);
    }
  }

  onTooOld(ant: Ant) {
    const deltaTau = evaluate(this.config.tauOnTooOld, {
      age: ant.path.length,
      hp: ant.hp,
      maxhp: ant.maxHp,
    });
    if (this.config.onTooOldMode === 0) {
      this.pathModify(ant.path, deltaTau, [1, 0.5]);
    } else {
      console.warn(`Unknown onTooOldMode: ${this.config.onTooOldMode}`);
    }
  }

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
