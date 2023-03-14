<script setup lang="ts">
import { Ant } from "./Ant";

const props = defineProps<{ ant: Ant }>();
const ant = props.ant;
</script>

<template>
  <v-card>
    <v-card-title>
      <v-icon icon="mdi-chess-pawn"></v-icon>
      Ant {{ ant.id }}
    </v-card-title>
    <v-card-text>
      <p>Player: {{ ant.player }}</p>
      <p>HP: {{ ant.hp }} / {{ ant.maxHp }}</p>
      <p>State: {{ ant.state }}</p>
      <p>PathLen: {{ ant.path.length }}</p>
      <p>
        Path: <code>{{ JSON.stringify(ant.path) }}</code>
      </p>
    </v-card-text>
  </v-card>
</template>
