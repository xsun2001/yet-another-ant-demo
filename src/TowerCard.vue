<script setup lang="ts">
import { computed } from "vue";
import { GameData } from "./GameData";

const props = defineProps<{
  x: number;
  y: number;
  gameData: GameData;
}>();

const emit = defineEmits<{
  (e: "updateTower", x: number, y: number, player: number, type: number): void;
}>();

const tower = computed(() => props.gameData.towers.getByPos(props.x, props.y)[0]);
const config = computed(() => tower.value?.config);
const attackType = computed(() => {
  let atk = tower.value?.config.attack;
  if (atk) {
    if (atk.type === "normal") {
      return `single ${atk.targetCount ?? 1} ${atk.attackCount ?? 1}`;
    } else if (atk.type === "aoe") {
      return `aoe ${atk.aoeRange ?? 1}`;
    } else {
      return atk.type;
    }
  } else {
    return "Unknown";
  }
});
const nextLevel = computed(() => props.gameData.nextLevelTower(tower.value?.config.type) ?? []);
const previousLevel = computed(() =>
  props.gameData.previousLevelTower(tower.value?.config.type ?? 0)
);
const isHighland = computed(() => props.gameData.highlandMask[props.x][props.y]);

function updateTower(player: number, type: number) {
  emit("updateTower", props.x, props.y, player, type);
}
</script>

<template>
  <v-card>
    <v-card-title>
      <v-icon icon="mdi-chess-rook"></v-icon>
      {{ tower ? `Tower ${tower.id}` : "No Tower" }}
    </v-card-title>
    <v-card-text>
      <template v-if="tower && config">
        <p>Player: {{ tower.player }}</p>
        <p>CD: {{ tower.cd }}</p>
        <p>Type: {{ config.name }}</p>
        <p>ATK: {{ config.damage }}</p>
        <p>Range: {{ config.range }}</p>
        <p>Interval: {{ config.interval }}</p>
        <p>ATK Type: {{ attackType }}</p>
        <v-btn
          block
          prepend-icon="mdi-chevron-up"
          v-for="[id, name] in nextLevel"
          :key="id"
          @click="updateTower(tower.player, id)"
        >
          Upgrade to [{{ name }}]
        </v-btn>
        <v-btn
          block
          prepend-icon="mdi-chevron-down"
          @click="updateTower(tower.player, previousLevel[0])"
        >
          {{ previousLevel[0] === -1 ? "Deconstruct" : `Downgrade to ${previousLevel[1]}` }}
        </v-btn>
      </template>
      <template v-else-if="isHighland">
        <v-btn block prepend-icon="mdi-hammer" @click="updateTower(0, 0)">P0 Build</v-btn>
        <v-btn block prepend-icon="mdi-hammer" @click="updateTower(1, 0)">P1 Build</v-btn>
      </template>
      <template v-else> Tower cannot be built here. </template>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.v-btn {
  margin: 5px;
}
</style>
