<script setup lang="ts">
import { ConfigHandler } from "./GameConfig";
import { GameData } from "./GameData";

const props = defineProps<{
  player: number;
  gameData: GameData;
}>();

const upgradeIcon = ["mdi-speedometer", "mdi-heart-plus"];
const upgradeName = ["Ant CD", "Ant HP"];

function lvArray(type: number) {
  return type === 0 ? props.gameData.antCdLv : props.gameData.antHpLv;
}

function neededGold(type: number) {
  return ConfigHandler.config.lvUpCost[lvArray(type)[props.player]];
}

function upgrade(type: number) {
  props.gameData.gold[props.player] -= neededGold(type);
  lvArray(type)[props.player]++;
}
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
      <template v-for="i in 2">
        <v-btn
          block
          v-if="lvArray(i - 1)[props.player] < 2"
          :disabled="neededGold(i - 1) > gameData.gold[player]"
          :prepend-icon="upgradeIcon[i - 1]"
          @click="upgrade(i - 1)"
        >
          Upgrade {{ upgradeName[i - 1] }}
          {{ neededGold(i - 1) > gameData.gold[player] ? `Need ${neededGold(i - 1)}G` : "" }}
        </v-btn>
      </template>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.v-btn {
  margin: 5px 0;
}
</style>
