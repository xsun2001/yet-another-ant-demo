import { z } from "zod";

export const TowerConfig = z.object({
  id: z.number().refine((v) => v >= 0),
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
  baseId: z.number().refine((v) => v >= 0),
  color: z.string().refine((v) => /^#[0-9A-F]{6}$/i.test(v)),
});

export type TowerConfig = z.infer<typeof TowerConfig>;

export const PheromoneConfig = z.object({
  // Basic Parameter
  tau0: z.number(),
  tauBase: z.number(),
  tauMin: z.number(),
  rho: z.number(),
  alpha: z.number(),
  beta: z.number(),
  tauOnDamaged: z.number(),
  tauOnDead: z.number(),
  tauOnReached: z.number(),

  // Modes
  globalDecayMode: z.number(),
  onDamagedMode: z.number(),
  onDeadMode: z.number(),
  onTooOldMode: z.number(),
  onReachedMode: z.number(),
  probabilityMode: z.number(),
  targetInfluenceMode: z.number(),
});

export type PheromoneConfig = z.infer<typeof PheromoneConfig>;

export const GameConfig = z.object({
  initHp: z.number().refine((v) => v >= 0),
  initGold: z.number().refine((v) => v >= 0),
  barrackCd: z.number().refine((v) => v >= 0),
  antAgeLimit: z.number().refine((v) => v >= 0),
  towers: TowerConfig.array(),
  pheromone: PheromoneConfig,
});

export type GameConfig = z.infer<typeof GameConfig>;

export const DefaultConfig: GameConfig = {
  initHp: 100,
  initGold: 50,
  barrackCd: 2,
  antAgeLimit: 64,
  // prettier-ignore
  towers: [
    { id: 0,  name: "Base",    damage: 4, range: 4, interval: 2, baseId:-1, color: "#898989", attack: { type: "normal" } },
    { id: 1,  name: "Heavy",   damage:10, range: 4, interval: 2, baseId: 0, color: "#fe9539", attack: { type: "normal" } },
    { id: 11, name: "Heavy+",  damage:20, range: 5, interval: 2, baseId: 1, color: "#ff2727", attack: { type: "normal" } },
    { id: 12, name: "Ice",     damage: 8, range: 6, interval: 2, baseId: 1, color: "#0008fe", attack: { type: "ice" } },
    { id: 13, name: "Cannon",  damage:45, range: 5, interval: 3, baseId: 1, color: "#810000", attack: { type: "normal" } },
    { id: 2,  name: "Quick",   damage: 4, range: 4, interval: 1, baseId: 0, color: "#f5f572", attack: { type: "normal" } },
    { id: 21, name: "Quick+",  damage: 4, range: 5, interval: 1, baseId: 2, color: "#bccd09", attack: { type: "normal", attackCount: 2 } },
    { id: 22, name: "Double",  damage: 6, range: 6, interval: 1, baseId: 2, color: "#e1e431", attack: { type: "normal", targetCount: 2 } },
    { id: 23, name: "Sniper",  damage: 6, range: 8, interval: 1, baseId: 2, color: "#00fc15", attack: { type: "normal" } },
    { id: 3,  name: "Mortar",  damage: 9, range: 7, interval: 3, baseId: 0, color: "#22b2ff", attack: { type: "aoe", aoeRange: 1 } },
    { id: 31, name: "Mortar+", damage:15, range: 8, interval: 3, baseId: 3, color: "#34b0c1", attack: { type: "aoe", aoeRange: 1 } },
    { id: 32, name: "Pulse",   damage:10, range: 3, interval: 3, baseId: 3, color: "#a0640b", attack: { type: "pulse" } },
    { id: 33, name: "Missile", damage:20, range:10, interval: 5, baseId: 3, color: "#ff00ff", attack: { type: "aoe", aoeRange: 2 } },
  ],
  pheromone: {
    tau0: 10,
    tauBase: 10,
    tauMin: 0.01,
    rho: 0.9,
    alpha: 1,
    beta: 1,
    tauOnDamaged: -3,
    tauOnDead: -5,
    tauOnReached: 10,

    globalDecayMode: 0,
    onDamagedMode: 0,
    onDeadMode: 0,
    onTooOldMode: 0,
    onReachedMode: 0,
    probabilityMode: 0,
    targetInfluenceMode: 0,
  },
};
