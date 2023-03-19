<script setup lang="ts">
import { GameData } from "./GameData";

const props = defineProps<{ gameData: GameData }>();
</script>

<template>
  <v-app-bar title="Yet Another Ant Demo V2"></v-app-bar>
</template>
