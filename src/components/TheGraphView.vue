<script setup>
import { ref, onMounted, onUnmounted } from "vue";
import { ConfigurableLayout } from "@/graphConfigurableLayout.js";
import { usePanelStore } from "@/stores/panels.js";
import { useStyleStore } from "@/stores/graphStyle.js";

const panelStore = usePanelStore();
const styleStore = useStyleStore();

const graphElem = ref(null);

// Catch pan start/stop events
const mousedown = function (event) {
  emit("pan-start", event);
};
const mouseup = function (event) {
  emit("pan-stop", event);
};

// Watch and update grid snap settings
onMounted(() => {
  styleStore.view.layoutHandler = new ConfigurableLayout(styleStore.layout);
  styleStore.graph = graphElem.value;
});
onUnmounted(() => {
  delete styleStore.graph;
});

// Graph event handers
const eventHandlers = {
  // Watch for node move event
  "node:dragend": (_, event) => {
    emit("node-move", event);
  },
};

// Register properties
defineProps({
  graph: Object,
  selectedNodes: Array,
  selectedEdges: Array,
  markedNodes: Object,
});

// Register emit events
const emit = defineEmits([
  "pan-start",
  "pan-stop",
  "node-move",
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
    :nodes="graph.nodes"
    :edges="graph.edges"
    :paths="graph.paths"
    :layouts="graph.layouts"
    :selected-nodes="selectedNodes"
    :selected-edges="selectedEdges"
    @update:selected-nodes="(v) => emit('update:selectedNodes', v)"
    @update:selected-edges="(v) => emit('update:selectedEdges', v)"
    :configs="styleStore"
    v-model:zoom-level="styleStore.extra.zoomLevel"
    :event-handlers="eventHandlers"
    ref="graphElem"
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
