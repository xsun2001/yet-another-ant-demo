<script setup lang="ts">
import { computed } from "vue";
import { isPlayerHighland } from "./Coord";
import { ConfigHandler } from "./GameConfig";
import { Tower } from "./Tower";

const props = defineProps<{
  player: number;
  x: number;
  y: number;
  tower: Tower | undefined;
  autoPlaying: boolean;
}>();

const emit = defineEmits<{
  (e: "updateTower", x: number, y: number, player: number, type: number): void;
}>();

const config = computed(() =>
  props.tower ? ConfigHandler.towerConfig(props.tower?.config.type) : undefined
);
const attackType = computed(() => {
  let atk = props.tower?.config.attack;
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
const nextLevel = computed(() =>
  props.tower ? ConfigHandler.advanceOfTower(props.tower.config.type) : []
);
const previousLevel = computed(() =>
  props.tower ? ConfigHandler.baseOfTower(props.tower.config.type) : undefined
);
const canBuild = computed(() => isPlayerHighland(props.x, props.y, props.player));

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
        <p>CD: {{ tower.cd }}</p>
        <p>Type: {{ config.name }}</p>
        <p>ATK: {{ config.damage }}</p>
        <p>Range: {{ config.range }}</p>
        <p>Interval: {{ config.interval }}</p>
        <p>ATK Type: {{ attackType }}</p>
        <template v-if="autoPlaying"> Stop AutoPlay to build tower </template>
        <template v-else>
          <v-btn
            block
            prepend-icon="mdi-chevron-up"
            v-for="t in nextLevel"
            :key="t.type"
            @click="updateTower(props.player, t.type)"
          >
            Upgrade to [{{ t.name }}]
          </v-btn>
          <v-btn
            v-if="tower.config.type === 0"
            block
            prepend-icon="mdi-selection-remove"
            @click="updateTower(props.player, -1)"
          >
            Deconstruct
          </v-btn>
          <v-btn
            v-else-if="previousLevel"
            block
            prepend-icon="mdi-chevron-down"
            @click="updateTower(props.player, previousLevel!.type)"
          >
            Downgrade to [{{ previousLevel!.name }}]
          </v-btn>
        </template>
      </template>
      <template v-else-if="canBuild">
        <template v-if="autoPlaying"> Stop AutoPlay to build tower </template>
        <template v-else>
          <v-btn block prepend-icon="mdi-hammer" @click="updateTower(props.player, 0)">
            Build New Tower
          </v-btn>
        </template>
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
