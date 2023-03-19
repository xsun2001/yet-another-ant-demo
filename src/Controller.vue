<script setup lang="ts">
const props = defineProps<{ round: number; autoPlaying: boolean }>();

const emits = defineEmits<{
  (e: "nextRound"): void;
  (e: "toggleAutoPlaying"): void;
}>();
</script>

<template>
  <v-app-bar title="Yet Another Ant Demo V2">
    <template v-slot:append>
      Round: {{ round }}
      <v-btn
        prepend-icon="mdi-code-greater-than"
        color="blue"
        :disabled="autoPlaying"
        @click="emits('nextRound')"
      >
        Next Round
      </v-btn>
      <v-btn
        :prepend-icon="autoPlaying ? 'mdi-pause' : 'mdi-play'"
        :color="autoPlaying ? 'orange' : 'green'"
        @click="emits('toggleAutoPlaying')"
      >
        AutoPlay
      </v-btn>
    </template>
  </v-app-bar>
</template>
