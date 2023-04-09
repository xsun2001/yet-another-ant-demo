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
  lvUpCost: [200, 250],
  antAgeLimit: 32,
  goalGold: 8,
  roundGoldLv: [1, 3, 6],
  // prettier-ignore
  towers: [
    { type: 0,  name: "Base",    damage: 5, range: 2, interval: 2, baseType:-1, cost:  15, attack: { type: "normal" } },
    { type: 1,  name: "Heavy",   damage:20, range: 2, interval: 2, baseType: 0, cost:  60, attack: { type: "normal" } },
    { type: 11, name: "Heavy+",  damage:35, range: 3, interval: 2, baseType: 1, cost: 200, attack: { type: "normal" } },
    { type: 12, name: "Ice",     damage:15, range: 2, interval: 2, baseType: 1, cost: 200, attack: { type: "ice" } },
    { type: 13, name: "Cannon",  damage:50, range: 3, interval: 3, baseType: 1, cost: 200, attack: { type: "normal" } },
    { type: 2,  name: "Quick",   damage: 6, range: 3, interval: 1, baseType: 0, cost:  60, attack: { type: "normal" } },
    { type: 21, name: "Quick+",  damage: 8, range: 3, interval: 1, baseType: 2, cost: 200, attack: { type: "normal", attackCount: 2 } },
    { type: 22, name: "Double",  damage: 9, range: 4, interval: 1, baseType: 2, cost: 200, attack: { type: "normal", targetCount: 2 } },
    { type: 23, name: "Sniper",  damage:15, range: 6, interval: 2, baseType: 2, cost: 200, attack: { type: "normal" } },
    { type: 3,  name: "Mortar",  damage:16, range: 3, interval: 4, baseType: 0, cost:  60, attack: { type: "aoe", aoeRange: 1 } },
    { type: 31, name: "Mortar+", damage:35, range: 4, interval: 4, baseType: 3, cost: 200, attack: { type: "aoe", aoeRange: 1 } },
    { type: 32, name: "Pulse",   damage:30, range: 2, interval: 3, baseType: 3, cost: 200, attack: { type: "pulse" } },
    { type: 33, name: "Missile", damage:45, range: 5, interval: 6, baseType: 3, cost: 200, attack: { type: "aoe", aoeRange: 2 } },
  ],
  newTowerCost: 15,
  superWeapon: [
    { cost: 150, cd: 100 },
    { cost: 150, cd: 100 },
    { cost: 100, cd: 50 },
    { cost: 100, cd: 50 },
  ],
  pheromone: {
    tau0: 10,
    rho: 0.97,
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
