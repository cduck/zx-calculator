<script setup>
import { ref } from "vue";
import TheGraphView from "@/components/TheGraphView.vue";
import ThePanelOverlay from "@/components/ThePanelOverlay.vue";

const overlayInactive = ref(false);
const panstart = () => {
  overlayInactive.value = true;
};
const panstop = () => {
  overlayInactive.value = false;
};
</script>

<template>
  <TheGraphView @pan-start="panstart" @pan-stop="panstop" />
  <ThePanelOverlay
    :class="{ 'panel-inactive': overlayInactive }"
    ref="overlay"
  />
</template>

<style>
@import "@/assets/base.css";

/* Global to effect all children of the panel overlay */
.panel-inactive {
  opacity: 0.7;
}
.panel-inactive,
.panel-inactive * {
  pointer-events: none !important;
}
</style>
