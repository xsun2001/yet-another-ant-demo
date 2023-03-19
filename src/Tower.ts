import { Ant, AntState } from "./Ant";
import { TowerConfig } from "./GameConfig";
import { MapLayer } from "./MapLayer";
import * as Coord from "./Coord";

export type AttackFunc = (tower: Tower, ants: MapLayer<Ant>) => [Ant, number][];

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
  return selected;
}

export function damageAndLog(tower: Tower, ant: Ant, damage: number) {
  const previousHp = ant.hp;
  ant.hp -= damage;
  console.log(`Tower ${tower.id} attacks Ant ${ant.id} | HP ${previousHp} -> ${ant.hp}`);
}

export function normal(targetCount: number, attackCount: number): AttackFunc {
  return (tower, ants) => {
    let attacked: [Ant, number][] = [];
    for (let i = 0; i < attackCount; i++) {
      let targets = findTargetAnts(tower, ants);
      for (let j = 0; j < targetCount && j < targets.length; j++) {
        damageAndLog(tower, targets[j], tower.config.damage);
        attacked.push([targets[j], tower.config.damage]);
      }
    }
    return attacked;
  };
}

export function ice(): AttackFunc {
  return (tower, ants) => {
    let targets = findTargetAnts(tower, ants);
    if (targets.length == 0) {
      return [];
    }
    damageAndLog(tower, targets[0], tower.config.damage);
    targets[0].state = AntState.Frozen;
    return [[targets[0], tower.config.damage]];
  };
}

function aoeDamageAt(
  tower: Tower,
  x: number,
  y: number,
  range: number,
  damage: number,
  ants: MapLayer<Ant>
): [Ant, number][] {
  return ants
    .getByRange(x, y, range)
    .filter((ant) => ant.hp > 0 && ant.player !== tower.player)
    .map((ant) => {
      damageAndLog(tower, ant, damage);
      return [ant, damage];
    });
}

export function aoe(damageRange: number): AttackFunc {
  return (tower, ants) => {
    let targets = findTargetAnts(tower, ants);
    if (targets.length == 0) {
      return [];
    }
    return aoeDamageAt(tower, targets[0].x, targets[0].y, damageRange, tower.config.damage, ants);
  };
}

export function pulse(): AttackFunc {
  return (tower, ants) => {
    if (findTargetAnts(tower, ants).length == 0) {
      return [];
    }
    return aoeDamageAt(tower, tower.x, tower.y, tower.config.range, tower.config.damage, ants);
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

  attack(ants: MapLayer<Ant>): [Ant, number][] {
    if (this.config.attack.type == "normal") {
      return normal(this.config.attack.targetCount ?? 1, this.config.attack.attackCount ?? 1)(
        this,
        ants
      );
    } else if (this.config.attack.type == "ice") {
      return ice()(this, ants);
    } else if (this.config.attack.type == "aoe") {
      return aoe(this.config.attack.aoeRange ?? 1)(this, ants);
    } else if (this.config.attack.type == "pulse") {
      return pulse()(this, ants);
    } else {
      console.warn("Unknown attack type: " + JSON.stringify(this.config.attack));
      return [];
    }
  }
}
