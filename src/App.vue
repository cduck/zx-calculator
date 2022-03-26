<script setup>
import { ref, onBeforeMount, onBeforeUnmount } from "vue";
import TheGraphView from "@/components/TheGraphView.vue";
import ThePanelOverlay from "@/components/ThePanelOverlay.vue";

const overlayInactive = ref(false);
const captureInput = ref(null);

onBeforeMount(() => {
  window.addEventListener("keyup", keyup);
});
onBeforeUnmount(() => {
  window.removeEventListener("keyup", keyup);
});
const panstart = () => {
  overlayInactive.value = true;
};
const panstop = () => {
  overlayInactive.value = false;
};
const keyup = (e) => {
  if (e.target instanceof HTMLInputElement) {
    return;
  }
  if (!e.altKey && !e.ctrlKey && !e.metaKey) {
    let k = e.key;
    if (k === "Backspace") { // Allow backspace or 'x'
      k = e.shiftKey ? "X" : "x";
    }
    command(k);
  }
};
const command = (code) => {
  console.log(`Command: ${code}`);
};
</script>

<template>
  <TheGraphView @pan-start="panstart" @pan-stop="panstop" />
  <ThePanelOverlay
    :class="{ 'panel-inactive': overlayInactive }"
    @command="command"
  />
</template>

<style>
@import "@/assets/base.css";

/* Allow dragging the graph viewport through the panels */
/* Global to effect all children of the panel overlay */
.panel-inactive {
  opacity: 0.7;
}
.panel-inactive,
.panel-inactive * {
  pointer-events: none !important;
}
</style>

<style scoped></style>
