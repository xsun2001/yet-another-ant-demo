<script setup lang="ts">
import { computed } from "vue";
import { GameData } from "./GameData";
import AntCard from "./AntCard.vue";
import TowerCard from "./TowerCard.vue";
import PheromoneCard from "./PheromoneCard.vue";
import PlayerCard from "./PlayerCard.vue";
import { isCoordValid } from "./Coord";

const props = defineProps<{
  player: number;
  gameData: GameData;
  selectedX: number;
  selectedY: number;
}>();

const emit = defineEmits<{
  (e: "updateTower", x: number, y: number, player: number, type: number): void;
}>();

const selectedValid = computed(() => isCoordValid(props.selectedX, props.selectedY));

const moveInfo = computed(() =>
  props.gameData.moveInformation(props.selectedX, props.selectedY, props.player)
);
const selectedTower = computed(
  () =>
    props.gameData.towers
      .getByPos(props.selectedX, props.selectedY)
      .filter((t) => t.player === props.player)[0]
);
const selectedAnt = computed(() =>
  props.gameData.ants
    .getByPos(props.selectedX, props.selectedY)
    .filter((a) => a.player === props.player)
);

function updateTower(player: number, type: number) {
  emit("updateTower", props.selectedX, props.selectedY, player, type);
}
</script>

<template>
  <player-card :player="player" :game-data="gameData"></player-card>
  <template v-if="selectedValid">
    <pheromone-card v-if="moveInfo" :info="moveInfo"></pheromone-card>
    <tower-card
      v-if="selectedTower"
      :player="player"
      :x="selectedX"
      :y="selectedY"
      :tower="selectedTower"
      :key="selectedTower.id"
      @update-tower="updateTower"
    ></tower-card>
    <ant-card v-for="ant in selectedAnt" :ant="ant" :key="ant.id"></ant-card>
  </template>
</template>

<style scoped>
.v-card {
  margin: 10px;
  width: 350px;
}
</style>
