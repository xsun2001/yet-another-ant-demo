import { z } from "zod";

export const TowerConfig = z.object({
  type: z.number().refine((v) => v >= 0),
  name: z.string(),
  damage: z.number().refine((v) => v > 0),
  range: z.number().refine((v) => v > 0),
  interval: z.number().refine((v) => v > 0),
  attack: z.object({
    type: z.string(),
    attackCount: z.number().optional(),
    targetCount: z.number().optional(),
    aoeRange: z.number().optional(),
  }),
  baseType: z.number(),
  cost: z.number(),
});

export type TowerConfig = z.infer<typeof TowerConfig>;

export const PheromoneConfig = z.object({
  tau0: z.number(),
  rho: z.number(),
  tauOnDead: z.number(),
  tauOnReached: z.number(),
  tauOnTooOld: z.number(),
  eta: z.number().array(),
});

export type PheromoneConfig = z.infer<typeof PheromoneConfig>;

export const GameConfig = z.object({
  initHp: z.number().refine((v) => v >= 0),
  initGold: z.number().refine((v) => v >= 0),
  antHpLv: z.number().array(),
  antCdLv: z.number().array(),
  lvUpCost: z.number().array(),
  antAgeLimit: z.number().refine((v) => v >= 0),
  towers: TowerConfig.array(),
  newTowerCost: z.number().refine((v) => v >= 0),
  superWeapon: z.object({ cost: z.number(), cd: z.number() }).array(),
  pheromone: PheromoneConfig,
});

export type GameConfig = z.infer<typeof GameConfig>;

export const DefaultConfig: GameConfig = {
  initHp: 100,
  initGold: 50,
  antHpLv: [10, 25, 50],
  antCdLv: [4, 2, 1],
  lvUpCost: [100, 200],
  antAgeLimit: 64,
  // prettier-ignore
  towers: [
    { type: 0,  name: "Base",    damage: 5, range: 2, interval: 2, baseType:-1, cost:  15, attack: { type: "normal" } },
    { type: 1,  name: "Heavy",   damage:10, range: 4, interval: 2, baseType: 0, cost:  60, attack: { type: "normal" } },
    { type: 11, name: "Heavy+",  damage:20, range: 5, interval: 2, baseType: 1, cost: 100, attack: { type: "normal" } },
    { type: 12, name: "Ice",     damage: 8, range: 6, interval: 2, baseType: 1, cost: 100, attack: { type: "ice" } },
    { type: 13, name: "Cannon",  damage:45, range: 5, interval: 3, baseType: 1, cost: 100, attack: { type: "normal" } },
    { type: 2,  name: "Quick",   damage: 4, range: 4, interval: 1, baseType: 0, cost:  60, attack: { type: "normal" } },
    { type: 21, name: "Quick+",  damage: 4, range: 5, interval: 1, baseType: 2, cost: 100, attack: { type: "normal", attackCount: 2 } },
    { type: 22, name: "Double",  damage: 6, range: 6, interval: 1, baseType: 2, cost: 100, attack: { type: "normal", targetCount: 2 } },
    { type: 23, name: "Sniper",  damage: 6, range: 8, interval: 1, baseType: 2, cost: 100, attack: { type: "normal" } },
    { type: 3,  name: "Mortar",  damage: 9, range: 7, interval: 3, baseType: 0, cost:  60, attack: { type: "aoe", aoeRange: 1 } },
    { type: 31, name: "Mortar+", damage:15, range: 8, interval: 3, baseType: 3, cost: 100, attack: { type: "aoe", aoeRange: 1 } },
    { type: 32, name: "Pulse",   damage:10, range: 3, interval: 3, baseType: 3, cost: 100, attack: { type: "pulse" } },
    { type: 33, name: "Missile", damage:20, range:10, interval: 5, baseType: 3, cost: 100, attack: { type: "aoe", aoeRange: 2 } },
  ],
  newTowerCost: 15,
  superWeapon: [
    { cost: 150, cd: 100 },
    { cost: 150, cd: 75 },
    { cost: 100, cd: 55 },
    { cost: 100, cd: 35 },
  ],
  pheromone: {
    tau0: 10,
    rho: 0.96,
    tauOnDead: -8,
    tauOnReached: 10,
    tauOnTooOld: -5,
    eta: [1.25, 1, 0.75],
  },
};

export class ConfigHandler {
  static config: GameConfig = DefaultConfig;

  static tryLoadConfigFromLS() {
    try {
      const configStr = localStorage.getItem("gameConfig");
      if (configStr) {
        const newConfig = GameConfig.parse(JSON.parse(configStr));
        ConfigHandler.config = newConfig;
      }
    } catch (e) {
      console.warn(e);
      ConfigHandler.storeConfigToLS();
    }
  }

  static storeConfigToLS() {
    localStorage.setItem("gameConfig", JSON.stringify(ConfigHandler.config));
  }

  static towerConfig(towerType: number) {
    return ConfigHandler.config.towers.find((t) => t.type === towerType);
  }

  static baseOfTower(towerType: number) {
    return ConfigHandler.towerConfig(ConfigHandler.towerConfig(towerType)?.baseType ?? -1);
  }

  static advanceOfTower(towerType: number) {
    return ConfigHandler.config.towers.filter((t) => t.baseType === towerType);
  }
}
