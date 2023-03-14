<script setup lang="ts">
import { ref, Ref } from "@vue/reactivity";
import Konva from "konva";
import { watch } from "vue";
import { Ant, GameData, Pheromone, Tower } from "./GameData";
import * as Coord from "./CoordUtils";
import { DefaultConfig, GameConfig } from "./GameConfig";
import { renderConfig, coord2screen, arrayEq } from "./Utils";
import PheromoneCard from "./PheromoneCard.vue";
import TowerCard from "./TowerCard.vue";
import AntCard from "./AntCard.vue";

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

const editorMode = ref(true);

const round = ref(0);
const mapLen = ref(10);

const animationInterval = ref(200);
const autoplayInterval = ref(300);

const selectedPos: Ref<[number, number] | null> = ref(null);
const selectedAnts: Ref<Ant[]> = ref([]);

let konvaStage: Konva.Stage | null = null;
let bgLayer: Konva.Layer | null = null;
let mainLayer: Konva.Layer | null = null;
let gameData: GameData | null = null;

function updateCellColor(x: number, y: number, cell: Konva.RegularPolygon) {
  if (gameData) {
    if (arrayEq([x, y], gameData.hqPos[0])) {
      cell.fill("red");
    } else if (arrayEq([x, y], gameData.hqPos[1])) {
      cell.fill("blue");
    } else if (gameData.highlandMask[x][y]) {
      cell.fill("orange");
    } else {
      cell.fill("lightblue");
    }
  }
}

function updateSelectedData() {
  if (selectedPos.value) {
    const [x, y] = selectedPos.value;
    selectedAnts.value = gameData?.ants.getByPos(x, y) ?? [];
  } else {
    selectedAnts.value = [];
  }
}

watch(selectedPos, (coord) => {
  const border = bgLayer?.findOne("#SELECTED") as Konva.RegularPolygon;
  if (!border) return;
  if (coord) {
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
      stroke: "black",
      strokeWidth: 2,
      rotation: 90,
    });
    cell.on("mousedown", () => {
      if (gameData) {
        if (editorMode.value) {
          gameData.toggleHighland(x, y);
          updateCellColor(x, y, cell);
        } else {
          let selected = true;
          if (selectedPos.value) {
            const [sx, sy] = selectedPos.value;
            if (x === sx && y === sy) {
              selectedPos.value = null;
              selected = false;
            }
          }
          if (selected) {
            selectedPos.value = [x, y];
          }
        }
      } else {
        console.warn("GameData object is null");
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

watch(mapLen, (len) => {
  if (len < 3 || len >= 16) {
    console.warn(`Map length ${len} is out of range`);
    return;
  }
  gameData = new GameData(len, gameData ? gameData.config : DefaultConfig);
  setupKonvaStage(len);
});

const vKonvaDiv = {
  mounted: (el: HTMLDivElement) => {
    // Load config from localStorage
    const mapLenStr = localStorage.getItem("mapLen");
    let mapLen = mapLenStr ? parseInt(mapLenStr) : 10;
    if (isNaN(mapLen) || mapLen < 3 || mapLen >= 16) mapLen = 10;

    const gameConfigStr = localStorage.getItem("gameConfig");
    let gameConfig = DefaultConfig;
    try {
      if (gameConfigStr) gameConfig = GameConfig.parse(JSON.parse(gameConfigStr));
    } catch (e) {
      console.warn("Failed to parse game config from localStorage", e);
    }

    gameData = new GameData(mapLen, gameConfig);
    const highlandMaskStr = localStorage.getItem("highlandMask");
    if (highlandMaskStr) gameData.importHighland(highlandMaskStr);

    // Construct Konva Stage
    const stage = new Konva.Stage({
      container: el,
      width: el.offsetWidth,
      height: el.offsetHeight,
    });
    konvaStage = stage;
    setupKonvaStage(mapLen);
  },
};

function finishEditing() {
  editorMode.value = false;
  localStorage.setItem("mapLen", mapLen.value.toString());
  localStorage.setItem("highlandMask", gameData ? gameData.exportHighland() : "");
}

const importDesignShow = ref(false);
const imported = ref("");
function importDesign() {
  if (gameData) {
    gameData.importHighland(imported.value);
    imported.value = "";
    for (let coord of Coord.inDistance(mapLen.value - 1, mapLen.value - 1, mapLen.value - 1)) {
      let [x, y] = coord;
      let cell = bgLayer?.findOne(`#CELL-${x}-${y}`) as Konva.RegularPolygon;
      updateCellColor(x, y, cell);
    }
  }
  importDesignShow.value = false;
}

const exportDesignShow = ref(false);
let exported: string | undefined;
function exportDesign() {
  exported = gameData?.exportHighland();
  exportDesignShow.value = true;
}

function nextRound() {
  if (gameData) {
    gameData.nextStep(mainLayer, animationInterval.value);
    round.value = gameData.round;
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

const configDialogShow = ref(false);
const configString = ref("");
function showConfigDialog() {
  configDialogShow.value = true;
  configString.value = JSON.stringify(gameData!.config, null, 2);
}
function saveConfig() {
  try {
    const config = GameConfig.parse(JSON.parse(configString.value));
    localStorage.setItem("gameConfig", configString.value);
    gameData!.config = config;
  } catch (e) {
    console.warn("Cannot parse config string", e);
  }
  configDialogShow.value = false;
}

const towerUpdateKey = ref(0);
function deconstructTowerOnly(x: number, y: number) {
  if (gameData && mainLayer) {
    let tower = gameData.towers.getByPos(x, y)[0];
    if (tower) {
      gameData.towers.data = gameData.towers.data.filter((t) => t.id !== tower.id);
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
    const newConfig = gameData.towerConfig(type);
    if (!newConfig) {
      console.warn(`Invalid tower type ${type}`);
      return;
    }

    let tower = gameData.towers.getByPos(x, y)[0];
    if (tower) {
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
        fill: player === 1 ? "red" : "blue",
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
</script>

<template>
  <v-layout>
    <v-navigation-drawer width="370">
      <div v-if="editorMode">
        <v-card title="Map Editor">
          <v-card-text>
            <v-text-field label="MapLen" type="number" v-model:model-value="mapLen"></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-btn color="primary" @click="finishEditing">Finish</v-btn>
            <v-btn color="secondary" @click="importDesignShow = true">Import</v-btn>
            <v-btn color="secondary" @click="exportDesign">Export</v-btn>
          </v-card-actions>
        </v-card>
        <v-card title="Game Configuration">
          <v-card-text>
            <v-text-field
              label="Animation Interval"
              type="number"
              v-model:model-value="animationInterval"
            ></v-text-field>
            <v-text-field
              label="Autoplay Interval"
              type="number"
              v-model:model-value="autoplayInterval"
            ></v-text-field>
          </v-card-text>
          <v-card-actions>
            <v-btn color="primary" prepend-icon="mdi-text-box-edit" @click="showConfigDialog">
              Modify Config
            </v-btn>
          </v-card-actions>
        </v-card>
      </div>

      <div v-else>
        <v-card>
          <v-card-title>Round: {{ round }}</v-card-title>
          <v-card-actions>
            <v-btn @click="nextRound" color="primary">Next Round</v-btn>
            <v-btn
              :prepend-icon="autoPlaying ? 'mdi-pause' : 'mdi-play'"
              :color="autoPlaying ? 'warning' : 'success'"
              @click="autoPlay"
            >
              AutoPlay
            </v-btn>
          </v-card-actions>
        </v-card>

        <template v-if="gameData && selectedPos">
          <v-card>
            <v-card-title>
              <v-icon icon="mdi-crosshairs-gps"></v-icon>
              Selected: [{{ selectedPos[0] }}, {{ selectedPos[1] }}]
            </v-card-title>
          </v-card>

          <tower-card
            :key="towerUpdateKey"
            :x="selectedPos[0]"
            :y="selectedPos[1]"
            :gameData="gameData"
            @update-tower="updateTower"
          />

          <pheromone-card
            v-for="p in 2"
            :key="p"
            :x="selectedPos[0]"
            :y="selectedPos[1]"
            :player="p - 1"
            :gameData="gameData"
          />
        </template>

        <ant-card v-for="ant in selectedAnts" :key="ant.id" :ant="ant" />
      </div>
    </v-navigation-drawer>

    <v-dialog v-model="importDesignShow">
      <v-card title="Import Design">
        <v-card-text>
          <v-textarea v-model:model-value="imported"></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-btn color="success" block @click="importDesign">Ok</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="exportDesignShow">
      <v-card title="Export Design">
        <v-card-text>
          <v-textarea :model-value="exported"></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-btn color="primary" block @click="exportDesignShow = false">Close</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-dialog v-model="configDialogShow">
      <v-card title="Config Editor">
        <v-card-text>
          <v-textarea auto-grow v-model:model-value="configString"></v-textarea>
        </v-card-text>
        <v-card-actions>
          <v-btn color="primary" block @click="saveConfig">Save Config</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>

    <v-app-bar title="Yet Another Ant Demo"></v-app-bar>

    <v-main style="min-height: 500px">
      <div style="height: 100vh" v-konva-div />
    </v-main>
  </v-layout>
</template>

<style scoped>
.v-navigation-drawer .v-card {
  margin: 10px;
  width: 350px;
}
</style>
