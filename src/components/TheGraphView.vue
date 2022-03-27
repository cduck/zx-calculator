<script setup>
//import * as vng from "v-network-graph";
import { usePanelStore } from "@/stores/panels.js";
import { useStyleStore } from "@/stores/graphStyle.js";
import { useGraphStore } from "@/stores/graph.js";

const panelStore = usePanelStore();
const styleStore = useStyleStore();
const graphStore = useGraphStore();

// Catch pan start/stop events
const mousedown = function (event) {
  emit("pan-start", event);
};
const mouseup = function (event) {
  emit("pan-stop", event);
};

// TODO
const eventHandlers = {
  "...": (event) => {
    console.log(event);
  },
};

// Register properties
const props = defineProps({
  selectedNodes: Array,
  selectedEdges: Array,
  markedNodes: Object,
});

// Register emit events
const emit = defineEmits([
  "pan-start",
  "pan-stop",
  "update:selectedNodes",
  "update:selectedEdges",
  "update:markedNodes",
]);
</script>

<template>
  <vNetworkGraph
    @mousedown="mousedown"
    @mouseup="mouseup"
    @mouseout="mouseup"
    :class="{ 'main-graph': true, edit: !panelStore.rewriteMode }"
    ref="graphElem"
    :nodes="graphStore.nodes"
    :edges="graphStore.edges"
    :paths="graphStore.paths"
    :layouts="graphStore.layouts"
    :selected-nodes="selectedNodes"
    :selected-edges="selectedEdges"
    @update:selected-nodes="v => emit('update:selectedNodes', v)"
    @update:selected-edges="v => emit('update:selectedEdges', v)"
    :configs="styleStore"
    v-model:zoom-level="styleStore.extra.zoomLevel"
    :event-handlers="eventHandlers"
  />
  <div class="test"></div>
</template>

<style scoped>
.main-graph {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(64, 158, 255, 0.1);
  transition: background-color 0.3s ease-out;
}
.main-graph.edit {
  background-color: rgba(238, 187, 0, 0.1);
}
</style>
