<script setup lang="ts">
import { reactive, ref, Ref } from "@vue/reactivity";
import Konva from "konva";
import { watch } from "vue";
import * as Coord from "./Coord";
import { ConfigHandler, DefaultConfig, GameConfig } from "./GameConfig";
import { renderConfig, coord2screen, arrayEq } from "./Utils";
import { Ant } from "./Ant";
import { GameData } from "./GameData";
import { Tower } from "./Tower";
import InfoPanel from "./InfoPanel.vue";
import Controller from "./Controller.vue";

/*
 * Editor mode
 * Click Node:
 * 1. Toggle highland
 *
 * Player mode
 * Click Node:
 * 1. If highland, show tower build menu and possible tower information
 * 2. If lowland, show pheromone and possible ant information
 * Next step:
 * 1. Run next step of simulation
 * 2. For all ants, update position
 * 3. For all dead ants, remove from map
 *
 * 1. onMounted -> Bind layer & draw background
 * 2. onClicked -> Update game data highlandMask & change color
 * 3. nextStep -> Create new ant node / Animate ant / Remove dead nodes
 */

const gameData = reactive(new GameData(Coord.MAP_LEN, DefaultConfig));

const animationInterval = ref(200);
const autoplayInterval = ref(300);

const selectedPos: Ref<number[]> = ref([0, 0]);
const selectedAnts: Ref<Ant[]> = ref([]);

let konvaStage: Konva.Stage | null = null;
let bgLayer: Konva.Layer | null = null;
let mainLayer: Konva.Layer | null = null;

function updateCellColor(x: number, y: number, cell: Konva.RegularPolygon) {
  if (gameData) {
    if (arrayEq([x, y], gameData.hqPos[0])) {
      cell.fill(renderConfig.color.p0);
    } else if (arrayEq([x, y], gameData.hqPos[1])) {
      cell.fill(renderConfig.color.p1);
    } else if (Coord.isP0Highland(x, y)) {
      cell.fill(renderConfig.color.p0Highland);
    } else if (Coord.isP1Highland(x, y)) {
      cell.fill(renderConfig.color.p1Highland);
    } else if (Coord.isHighland(x, y)) {
      cell.fill(renderConfig.color.highland);
    } else {
      cell.fill(renderConfig.color.path);
    }
  }
}

function updateSelectedData() {
  if (selectedPos.value && Coord.isCoordValid(selectedPos.value[0], selectedPos.value[1])) {
    const [x, y] = selectedPos.value;
    selectedAnts.value = gameData?.ants.getByPos(x, y) ?? [];
  } else {
    selectedAnts.value = [];
  }
}

watch(selectedPos, (coord) => {
  const border = bgLayer?.findOne("#SELECTED") as Konva.RegularPolygon;
  if (!border) return;
  if (coord && Coord.isCoordValid(coord[0], coord[1])) {
    const [sx, sy] = coord2screen(coord[0], coord[1]);
    border.x(sx);
    border.y(sy);
    border.strokeWidth(4);
  } else {
    border.strokeWidth(0);
  }
  updateSelectedData();
});

function setupKonvaStage(len: number) {
  if (konvaStage === null) return;

  if (bgLayer !== null) bgLayer.destroy();
  bgLayer = new Konva.Layer();
  for (let coord of Coord.inDistance(len - 1, len - 1, len - 1)) {
    let [x, y] = coord;
    let [px, py] = coord2screen(x, y);
    const cell = new Konva.RegularPolygon({
      x: px,
      y: py,
      id: `CELL-${x}-${y}`,
      sides: 6,
      radius: renderConfig.cellRadius,
      stroke: "#636363",
      strokeWidth: 2,
      rotation: 90,
    });
    cell.on("mousedown", () => {
      let selected = true;
      if (selectedPos.value) {
        const [sx, sy] = selectedPos.value;
        if (x === sx && y === sy) {
          selectedPos.value = [0, 0];
          selected = false;
        }
      }
      if (selected) {
        selectedPos.value = [x, y];
      }
    });
    updateCellColor(x, y, cell);
    bgLayer.add(cell);
  }
  const selectedBorder = new Konva.RegularPolygon({
    x: 0,
    y: 0,
    id: `SELECTED`,
    sides: 6,
    radius: renderConfig.cellRadius,
    stroke: "yellow",
    strokeWidth: 0,
    rotation: 90,
  });
  selectedBorder.listening(false);
  bgLayer.add(selectedBorder);
  konvaStage.add(bgLayer);
  bgLayer.draw();

  if (mainLayer !== null) mainLayer.destroy();
  mainLayer = new Konva.Layer();
  mainLayer.listening(false);
  konvaStage.add(mainLayer);
  mainLayer.draw();
}

const vKonvaDiv = {
  mounted: (el: HTMLDivElement) => {
    konvaStage = new Konva.Stage({
      container: el,
      width: 800,
      height: 800,
    });
    setupKonvaStage(Coord.MAP_LEN);
  },
};

function nextRound() {
  if (gameData) {
    gameData.nextStep(mainLayer, animationInterval.value);
    updateSelectedData();
  }
}

const autoPlaying = ref(false);
let autoTimer: number | undefined;
function autoPlay() {
  if (autoPlaying.value) {
    window.clearInterval(autoTimer);
    autoPlaying.value = false;
  } else {
    autoTimer = window.setInterval(nextRound, autoplayInterval.value);
    autoPlaying.value = true;
  }
}

// const configDialogShow = ref(false);
// const configString = ref("");
// function showConfigDialog() {
//   configDialogShow.value = true;
//   configString.value = JSON.stringify(gameData!.config, null, 2);
// }
// function saveConfig() {
//   try {
//     const config = GameConfig.parse(JSON.parse(configString.value));
//     localStorage.setItem("gameConfig", configString.value);
//     gameData!.config = config;
//   } catch (e) {
//     console.warn("Cannot parse config string", e);
//   }
//   configDialogShow.value = false;
// }

const towerUpdateKey = ref(0);
function deconstructTowerOnly(x: number, y: number) {
  if (gameData && mainLayer) {
    let tower = gameData.towers.getByPos(x, y)[0];
    if (tower) {
      gameData.towers.data = gameData.towers.data.filter((t) => t.id !== tower.id);
      gameData.gold[tower.player] += gameData.newTowerCost(tower.player) * 0.8;
      const towerRect = mainLayer.findOne(`#TOWER-RECT-${tower.id}`) as Konva.Rect;
      const towerText = mainLayer.findOne(`#TOWER-TEXT-${tower.id}`) as Konva.Text;
      towerRect?.destroy();
      towerText?.destroy();
      ++towerUpdateKey.value;
    }
  }
}
function updateTower(x: number, y: number, player: number, type: number) {
  console.log(`Update tower at (${x}, ${y}) to ${type} for player ${player}`);
  if (type === -1) {
    deconstructTowerOnly(x, y);
    return;
  }
  if (gameData && mainLayer) {
    const newConfig = ConfigHandler.towerConfig(type);
    if (!newConfig) {
      console.warn(`Invalid tower type ${type}`);
      return;
    }

    let tower = gameData.towers.getByPos(x, y)[0];
    if (tower) {
      if (tower.config.baseType === type) {
        // Downgrade
        gameData.gold[player] += tower.config.cost * 0.8;
      } else if (newConfig.baseType === tower.config.type) {
        // Upgrade
        if (newConfig.cost > gameData.gold[player]) {
          console.warn(
            `Player ${player} does not have enough gold to upgrade tower at [${x}, ${y}]`
          );
          return;
        }
        gameData.gold[player] -= newConfig.cost;
      } else {
        console.warn(
          `Tower at [${x}, ${y}] cannot be upgraded from ${tower.config.type} to ${type}`
        );
        return;
      }

      if (tower.player !== player) {
        console.warn(`Tower at [${x}, ${y}] is not owned by player ${player}`);
        return;
      }
      if (tower.config.type === type) {
        console.warn(`Tower at [${x}, ${y}] is already type ${type}`);
        return;
      }
      tower.config = newConfig;
      tower.cd = 0;

      const towerRect = mainLayer.findOne(`#TOWER-RECT-${tower.id}`) as Konva.Rect;
      const towerText = mainLayer.findOne(`#TOWER-TEXT-${tower.id}`) as Konva.Text;
      towerRect?.destroy();
      towerText?.destroy();
    } else {
      const newCost = gameData.newTowerCost(player);
      if (newCost > gameData.gold[player]) {
        console.warn(`Player ${player} does not have enough gold to build tower at [${x}, ${y}]`);
        return;
      }
      gameData.gold[player] -= newCost;
      tower = new Tower(gameData.towers.useNextIdx(), player, x, y, newConfig);
      gameData.towers.push(tower);
    }

    const [sx, sy] = coord2screen(x, y);
    const shapeConfig: Konva.ShapeConfig = {
      x: sx,
      y: sy,
      width: renderConfig.cellRadius,
      height: renderConfig.cellRadius,
      offsetX: renderConfig.cellRadius / 2,
      offsetY: renderConfig.cellRadius / 2,
    };
    mainLayer.add(
      new Konva.Rect({
        id: `TOWER-RECT-${tower.id}`,
        fill: renderConfig.playerColor(tower.player),
        stroke: "green",
        strokeWidth: 2,
        cornerRadius: 5,
        ...shapeConfig,
      })
    );
    mainLayer.add(
      new Konva.Text({
        id: `TOWER-TEXT-${tower.id}`,
        text: type.toString(),
        fill: "white",
        align: "center",
        verticalAlign: "middle",
        ...shapeConfig,
      })
    );

    // Force update tower card
    ++towerUpdateKey.value;
  }
}

function deploySuperWeapon(x: number, y: number, player: number, type: number) {
  gameData.deploySuperWeapon(player, type, x, y, mainLayer, animationInterval.value);
}
</script>

<template>
  <v-layout>
    <v-navigation-drawer
      v-for="i in 2"
      :location="i === 1 ? 'left' : 'right'"
      width="370"
      :color="i === 1 ? '#ff8484' : '#00b3ff'"
    >
      <info-panel
        :key="towerUpdateKey"
        :player="i - 1"
        :game-data="gameData"
        :selected-x="selectedPos[0]"
        :selected-y="selectedPos[1]"
        :auto-playing="autoPlaying"
        @update-tower="updateTower"
        @deploy-super-weapon="deploySuperWeapon"
      ></info-panel>
    </v-navigation-drawer>

    <controller
      :round="gameData.round"
      :auto-playing="autoPlaying"
      @next-round="nextRound"
      @toggle-auto-playing="autoPlay"
    ></controller>

    <v-main>
      <div style="display: flex; align-items: center; justify-content: center" v-konva-div></div>
    </v-main>
  </v-layout>
</template>
