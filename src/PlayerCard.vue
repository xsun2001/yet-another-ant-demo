<script setup lang="ts">
import { GameData } from "./GameData";

const props = defineProps<{
  player: number;
  gameData: GameData;
}>();
</script>

<template>
  <v-card>
    <v-card-title>
      <v-icon icon="mdi-controller"></v-icon>
      Player {{ player }}
    </v-card-title>
    <v-card-text>
      <p>HP: {{ gameData.hqHp[player] }}</p>
      <p>Gold: {{ gameData.gold[player] }}</p>
      <p>Ant CD LV: {{ gameData.antCdLv[player] }}</p>
      <p>Ant HP LV: {{ gameData.antHpLv[player] }}</p>
    </v-card-text>
  </v-card>
</template>
