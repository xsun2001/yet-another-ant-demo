<script setup lang="ts">
import { computed } from "vue";
import { ConfigHandler } from "./GameConfig";
import { GameData } from "./GameData";

const props = defineProps<{
  player: number;
  gameData: GameData;
}>();

const emits = defineEmits<{
  (e: "deploySuperWeapon", type: number): void;
}>();

function deploySuperWeapon(type: number) {
  emits("deploySuperWeapon", type);
}

const swName = ["Lightning Storm", "EMP Blast", "Deflector", "Emergency Evasion"];
const swIcon = [
  "mdi-weather-lightning",
  "mdi-access-point-network-off",
  "mdi-security",
  "mdi-exit-run",
];
const swCd = computed(() => props.gameData.swCd[props.player]);

function superWeaponGold(type: number) {
  return ConfigHandler.config.superWeapon[type].cost;
}

function hasEnoughGold(type: number) {
  return props.gameData.gold[props.player] >= superWeaponGold(type);
}

function superWeaponState(type: number) {
  if (swCd.value[type] > 0) {
    return `CD ${swCd.value[type]}`;
  } else if (!hasEnoughGold(type)) {
    return `Need ${superWeaponGold(type)}G`;
  } else {
    return "Ready";
  }
}
</script>

<template>
  <v-card>
    <v-card-title>
      <v-icon icon="mdi-crystal-ball"></v-icon>
      Super Weapon
    </v-card-title>
    <v-card-text>
      <v-btn
        v-for="i in 4"
        block
        :key="i"
        :prepend-icon="swIcon[i - 1]"
        :disabled="swCd[i - 1] > 0 || !hasEnoughGold(i - 1)"
        @click="deploySuperWeapon(i - 1)"
      >
        {{ swName[i - 1] }} {{ superWeaponState(i - 1) }}
      </v-btn>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.v-btn {
  margin: 5px 0;
}
</style>
