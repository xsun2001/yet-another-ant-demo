<script setup lang="ts">
import { ref, Ref } from "@vue/reactivity";
import Konva from "konva";
import { watch } from "vue";
import { GameData } from "./GameData";
import * as Coord from "./CoordUtils";
import { DefaultConfig } from "./GameConfig";
import { renderConfig, coord2screen, arrayEq } from "./Utils";

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
 * 3. nextStep -> Ant Delta -> Create new ant node / Animate ant / Remove dead nodes
 */

const editorMode = ref(true);

const round = ref(0);
const mapLen = ref(10);
const konva_stage: Ref<Konva.Stage | null> = ref(null);

let bgLayer: Konva.Layer | null;
let mainLayer: Konva.Layer | null;
let gameData: GameData | null;

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

watch([konva_stage, mapLen], ([stage, len]: [Konva.Stage | null, number]) => {
  if (stage == null) {
    return;
  }
  if (len < 3 || len >= 16) {
    console.warn(`Invalid map len ${len}`);
    return;
  }

  gameData = new GameData(len, DefaultConfig);

  stage.destroyChildren();

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
          // Show information
        }
      } else {
        console.warn("GameData object is null");
      }
    });
    updateCellColor(x, y, cell);
    bgLayer.add(cell);
  }
  stage.add(bgLayer);
  bgLayer.draw();

  mainLayer = new Konva.Layer();
  mainLayer.listening(false);
  stage.add(mainLayer);
  mainLayer.draw();
});

const vKonvaDiv = {
  mounted: (el: HTMLDivElement) => {
    const stage = new Konva.Stage({
      container: el,
      width: el.offsetWidth,
      height: el.offsetHeight,
    });
    konva_stage.value = stage;
  },
};

function finishEditing() {
  editorMode.value = false;
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
    gameData.nextStep(mainLayer);
    round.value = gameData.round;
  }
}
</script>

<template>
  <v-layout>
    <v-navigation-drawer width="300">
      <!-- Editor Mode Card -->
      <v-card title="Editor Mode" v-if="editorMode">
        <v-card-text>
          <v-text-field label="MapLen" type="number" v-model:model-value="mapLen"></v-text-field>
        </v-card-text>
        <v-card-actions>
          <v-btn color="primary" @click="finishEditing">Finish</v-btn>
          <v-btn color="secondary" @click="importDesignShow = true">Import</v-btn>
          <v-btn color="secondary" @click="exportDesign">Export</v-btn>
        </v-card-actions>
      </v-card>

      <div v-else>
        <v-card>
          <v-card-title>Round: {{ round }}</v-card-title>
          <v-card-actions>
            <v-btn @click="nextRound">Next Round</v-btn>
          </v-card-actions>
        </v-card>
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

    <v-app-bar title="Just Another Ant Demo"></v-app-bar>

    <v-main style="min-height: 500px">
      <div style="height: 100vh" v-konva-div />
    </v-main>
  </v-layout>
</template>

<style scoped>
.v-navigation-drawer .v-card {
  margin: 10px;
  width: 280px;
}
</style>
