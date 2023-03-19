import Konva from "konva";
import { Ant, AntState } from "./Ant";
import { GameConfig } from "./GameConfig";
import { MapLayer } from "./MapLayer";
import { Pheromone } from "./Pheromone";
import { Tower } from "./Tower";
import { arrayEq, coord2screen, probabilityChoose, renderConfig } from "./Utils";

export class GameData {
  len: number = 0;
  config: GameConfig;

  pheromone: [Pheromone, Pheromone];
  ants: MapLayer<Ant> = new MapLayer<Ant>();
  towers: MapLayer<Tower> = new MapLayer<Tower>();

  round: number = 0;
  gold: [number, number];
  hqHp: [number, number];
  hqPos: [number, number][] = [];
  antCdLv: [number, number] = [0, 0];
  antHpLv: [number, number] = [0, 0];

  constructor(len: number, config: GameConfig) {
    this.len = len;
    this.gold = [config.initGold, config.initGold];
    this.hqHp = [config.initHp, config.initHp];
    this.pheromone = [new Pheromone(len, config.pheromone), new Pheromone(len, config.pheromone)];
    this.config = config;

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

  nextStep(canvas: Konva.Layer | null, animationInterval: number) {
    console.log(`Round: ${this.round}`);
    let tweenList: Konva.Tween[] = [];

    this.pheromone.forEach((p) => p.globalDecay());

    // 1. Tower attack
    console.log("Tower attack");
    this.towers.data.forEach((tower) => {
      if (tower.cd > 0) {
        tower.cd--;
      }
      if (tower.cd === 0) {
        const attacked = tower.attack(this.ants);
        if (attacked.length > 0) {
          tower.cd = tower.config.interval;
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
      let prob = this.antMove(ant).prob;
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
    for (let player = 0; player < 2; player++) {
      if (this.round % this.config.antCdLv[this.antCdLv[player]] === 0) {
        const antHp = this.config.antHpLv[this.antHpLv[player]];
        let ant = new Ant(
          this.ants.useNextIdx(),
          player,
          this.hqPos[player][0],
          this.hqPos[player][1],
          antHp
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
      }
    }

    // 5. Other stuff
    tweenList.forEach((tween) => tween.play());
    this.round += 1;
    console.log();
  }
}
