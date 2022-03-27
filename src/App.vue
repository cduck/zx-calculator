<script setup>
import { ref, onBeforeMount, onBeforeUnmount } from "vue";
import TheGraphView from "@/components/TheGraphView.vue";
import ThePanelOverlay from "@/components/ThePanelOverlay.vue";
import { usePanelStore } from "@/stores/panels.js";
import * as gops from "@/graphOps";

const panelStore = usePanelStore();
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
  if (!panelStore.rewriteMode) {
    // Edit mode
    switch (code) {
      case "n":
        gops.addZNode();
        break;
      case "b":
        gops.addBoundaryNode();
        break;
      case "e":
        gops.toggleEdges(selectedNodes.value);
        break;
      case "E":
        gops.clearEdgesBetweenNodes(selectedNodes.value);
        break;
      case "x":
        gops.deleteEdges(selectedEdges.value);
        gops.deleteNodes(selectedNodes.value);
        break;
      case "a":
        setNodeAngles();
        break;
      case "s":
        gops.addPathByEdges(selectedEdges.value);
        break;
      case "S":
        gops.clearPathsByEdges(selectedEdges.value);
        gops.clearPathsByNodes(selectedEdges.value);
        break;
      default:
        break;
    }
  } else {
    // Rewrite mode
    switch (code) {
      default:
        break;
    }
  }
};

// Graph edit commands that clean up the selections before operating on the
// graph
const setNodeAngles = () => {
  gops.setAngle(
    selectedNodes.value.filter((n) => !gops.isBoundaryNode(n)),
    panelStore.angleToSet
  );
};

const selectedNodes = ref([]);
const selectedEdges = ref([]);
const markedNodes = ref({ a: [], b: [] });
</script>

<template>
  <TheGraphView
    v-model:selectedNodes="selectedNodes"
    v-model:selectedEdges="selectedEdges"
    v-model:markedNodes="markedNodes"
    @pan-start="panstart"
    @pan-stop="panstop"
  />
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
