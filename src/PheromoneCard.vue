<script setup lang="ts">
import { MoveInfo } from "./Pheromone";

const props = defineProps<{
  info: MoveInfo;
}>();

const directionIcon = [
  "mdi-arrow-bottom-right",
  "mdi-arrow-top-right",
  "mdi-arrow-up",
  "mdi-arrow-top-left",
  "mdi-arrow-bottom-left",
  "mdi-arrow-down",
];
</script>

<template>
  <v-card>
    <v-card-title>
      <v-icon icon="mdi-arrow-decision"></v-icon>
      Movement
    </v-card-title>
    <v-card-text>
      <p>
        V: <code>[{{ props.info.valid.map((v) => (v ? "✓" : "X")).join(", ") }}]</code>
      </p>
      <p>
        τ: <code>[{{ props.info.tau.map((p) => p.toFixed(3)).join(", ") }}]</code>
      </p>
      <p>
        η: <code>[{{ props.info.eta.map((p) => p.toFixed(3)).join(", ") }}]</code>
      </p>
      <p>
        P: <code>[{{ props.info.prob.map((p) => p.toFixed(3)).join(", ") }}]</code>
      </p>
      <p>Direction: <v-icon :icon="directionIcon[props.info.dir]"></v-icon></p>
    </v-card-text>
  </v-card>
</template>
