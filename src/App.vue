<script setup>
import { ref, onBeforeMount, onBeforeUnmount } from "vue";
import TheGraphView from "@/components/TheGraphView.vue";
import ThePanelOverlay from "@/components/ThePanelOverlay.vue";
import * as gops from "@/graphOps";

gops.graphOpsSetup();

// Disable overlay panels while panning
const overlayInactive = ref(false);
const panstart = () => {
  overlayInactive.value = true;
};
const panstop = () => {
  overlayInactive.value = false;
};

// Catch key strokes
onBeforeMount(() => {
  window.addEventListener("keyup", keyup);
});
onBeforeUnmount(() => {
  window.removeEventListener("keyup", keyup);
});
const keyup = (e) => {
  if (e.target instanceof HTMLInputElement) {
    return;
  }
  if (!e.altKey && !e.ctrlKey && !e.metaKey) {
    let k = e.key;
    // Allow backspace or 'x'
    if (k === "Backspace") {
      k = e.shiftKey ? "X" : "x";
    }
    command(k);
  }
};

// Execute graph commands
const command = (code) => {
  console.log(`Command: ${code}`);
  switch (code) {
    case "n":
      gops.addZNode();
      break;
  }
};

const selectedNodes = ref([]);
const selectedEdges = ref([]);
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
