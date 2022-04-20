<script setup>
import { ref } from "vue";
import { previewStyle } from "@/graphPreviewStyle.js";

const graphElem = ref("");

// Graph event handers
const eventHandlers = {
  "view:load": () => {
    if (props.zoomToFit) {
      zoomToFit(1);
    }
  },
};
const zoomToFit = (maxZoom) => {
  graphElem.value.panToCenter();
  graphElem.value.svgPanZoom
    .fit()
    .zoomBy(1 / 1.1)
    .center();
  const { realZoom } = graphElem.value.svgPanZoom.getSizes();
  if (maxZoom && realZoom > maxZoom) {
    graphElem.value.svgPanZoom.zoomBy(maxZoom / realZoom || 1);
  }
};

// Register properties
const props = defineProps({
  zoomToFit: Boolean,
  graph: Object,
});
</script>

<template>
  <vNetworkGraph
    class="preview-graph"
    :nodes="graph.nodes"
    :edges="graph.edges"
    :paths="graph.paths"
    :layouts="graph.layouts"
    :selected-nodes="graph.selectedNodes"
    :selected-edges="graph.selectedEdges"
    :configs="previewStyle"
    :event-handlers="eventHandlers"
    ref="graphElem"
  />
</template>

<style scoped>
.preview-graph {
  background-color: transparent;
  transition: background-color 0.3s ease-out;
  pointer-events: none;
}
</style>
