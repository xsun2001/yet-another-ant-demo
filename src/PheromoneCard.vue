<script setup lang="ts">
import { computed } from "vue";
import { GameData } from "./GameData";

const props = defineProps<{
  x: number;
  y: number;
  player: number;
  gameData: GameData;
}>();

const information = computed(() => props.gameData.moveInformation(props.x, props.y, props.player));
</script>

<template>
  <v-card>
    <v-card-title>
      <v-icon icon="mdi-arrow-decision"></v-icon>
      P{{ props.player }} Pheromone
    </v-card-title>
    <v-card-text>
      <p>
        V: <code>{{ JSON.stringify(information.valid) }}</code>
      </p>
      <p>
        τ: <code>[{{ information.tau.map((p) => p.toFixed(4)).join(", ") }}]</code>
      </p>
      <p>
        η: <code>[{{ information.eta.map((p) => p.toFixed(4)).join(", ") }}]</code>
      </p>
      <p>
        P: <code>[{{ information.prob.map((p) => p.toFixed(4)).join(", ") }}]</code>
      </p>
    </v-card-text>
  </v-card>
</template>
