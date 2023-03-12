<script setup lang="ts">
import { ref, Ref } from "@vue/reactivity";
import Konva from "konva";
import { watch } from "vue";
import { GameData } from "../utils/GameData";
import * as Coord from "../utils/CoordUtils";
import { DefaultConfig } from "../utils/GameConfig";
import { renderConfig, idx2pos } from "../utils/Utils";

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

const mapLen = ref(10);
const editorMode = ref(true);

const konva_stage: Ref<Konva.Stage | null> = ref(null);
let main_layer: Konva.Layer | null = null;

let gameData: GameData | null = null;
let round = ref(0);

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
  main_layer = new Konva.Layer({
    id: "main",
  });
  for (let pos of Coord.inDistance(len - 1, len - 1, len - 1)) {
    let [x, y] = pos;
    let fill = "lightblue";
    const isHq0 = x == gameData.hqPos[0][0] && y == gameData.hqPos[0][1];
    const isHq1 = x == gameData.hqPos[1][0] && y == gameData.hqPos[1][1];
    if (isHq0) fill = "red";
    if (isHq1) fill = "blue";
    const hex = new Konva.RegularPolygon({
      x: idx2pos(x, y)[0],
      y: idx2pos(x, y)[1],
      sides: 6,
      radius: renderConfig.cellRadius,
      fill,
      stroke: "black",
      strokeWidth: 2,
      rotation: 90,
    });
    hex.on("mousedown", () => {
      if (gameData) {
        if (editorMode.value) {
          if (isHq0 || isHq1) {
            return;
          }
          if (gameData.highlandMask[x][y]) {
            gameData.highlandMask[x][y] = false;
            hex.fill("lightblue");
          } else {
            gameData.highlandMask[x][y] = true;
            hex.fill("orange");
          }
        } else {
          // Show information
        }
      } else {
        console.warn("GameData object is null");
      }
    });
    main_layer.add(hex);
  }
  stage.add(main_layer);
  main_layer.draw();
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

function nextRound() {
  if (gameData) {
    gameData.nextStep(main_layer);
    round.value = gameData.round;
  }
}
</script>

<template>
  <v-layout>
    <v-navigation-drawer width="300">
      <v-card style="margin: 10px; width: 280px" title="Map Len">
        <v-card-text>
          <v-text-field type="number" v-model:model-value="mapLen"></v-text-field>
        </v-card-text>
      </v-card>

      <v-card style="margin: 10px; width: 280px">
        <v-card-title>Round: {{ gameData?.round }}</v-card-title>
        <v-card-actions>
          <v-btn @click="nextRound">Next Round</v-btn>
        </v-card-actions>
      </v-card>
    </v-navigation-drawer>

    <v-app-bar title="Just Another Ant Demo"></v-app-bar>

    <v-main style="min-height: 500px">
      <div style="height: 100vh" v-konva-div />
    </v-main>
  </v-layout>
</template>
