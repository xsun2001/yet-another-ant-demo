import { PheromoneConfig } from "./GameConfig";
import { twodimArray, genArray } from "./Utils";
import * as Coord from "./Coord";
import { Ant } from "./Ant";

export interface MoveInfo {
  valid: boolean[];
  tau: number[];
  eta: number[];
  prob: number[];
  dir: number;
}

export class Pheromone {
  len: number;
  value: number[][];
  config: PheromoneConfig;

  constructor(len: number, config: PheromoneConfig) {
    this.len = len;
    this.value = twodimArray(2 * len - 1, () => config.tau0 + Math.random() * 4.0 - 2.0);
    this.config = config;
  }

  pathModify(path: [number, number][], delta: number) {
    let mask = twodimArray(2 * this.len - 1, () => false);
    for (let coord of path) {
      let [x, y] = coord;
      if (!mask[x][y] && Coord.isCoordValid(x, y)) {
        mask[x][y] = true;
        this.value[x][y] = Math.max(0, this.value[x][y] + delta);
      }
    }
  }

  globalDecay() {
    const base = this.config.tau0;
    const rho = this.config.rho;
    for (let i = 0; i < 2 * this.len - 1; i++) {
      for (let j = 0; j < 2 * this.len - 1; j++) {
        this.value[i][j] = rho * this.value[i][j] + (1 - rho) * base;
      }
    }
  }

  onDead(ant: Ant) {
    this.pathModify(ant.path, this.config.tauOnDead);
  }

  onReached(ant: Ant) {
    this.pathModify(ant.path, this.config.tauOnReached);
  }

  onTooOld(ant: Ant) {
    this.pathModify(ant.path, this.config.tauOnTooOld);
  }

  etaTarget(x: number, y: number, dir: number, target: [number, number]): number {
    let [tx, ty] = target;
    let [dx, dy] = Coord.neighbor(x, y, dir);
    let distDelta = Coord.distance(tx, ty, dx, dy) - Coord.distance(tx, ty, x, y);
    if (distDelta === 1) {
      return 0.75;
    } else if (distDelta === 0) {
      return 1.0;
    } else if (distDelta === -1) {
      return 1.25;
    } else {
      console.warn(
        `Invalid distDelta. Target: [${tx}, ${ty}]. From: [${x}, ${y}]. To: [${dx}, ${dy}]`
      );
      return 0;
    }
  }

  moveInformation(
    x: number,
    y: number,
    target: [number, number],
    lastPos: [number, number] = [-1, -1]
  ): MoveInfo {
    const coord = genArray(6, (dir) => Coord.neighbor(x, y, dir));
    const valid = coord.map(
      ([x, y]) =>
        Coord.isCoordValid(x, y, this.len) &&
        !Coord.isHighland(x, y) &&
        !(x === lastPos[0] && y === lastPos[1])
    );
    const tau = coord.map(([x, y], dir) => (valid[dir] ? this.value[x][y] : 0));
    const eta = valid.map((valid, dir) => (valid ? this.etaTarget(x, y, dir, target) : 0));
    const prob = valid.map((valid, dir) => (valid ? tau[dir] * eta[dir] : -10));
    const dir = prob.indexOf(Math.max(...prob));

    return {
      valid,
      tau,
      eta,
      prob,
      dir,
    };
  }
}
