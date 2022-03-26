<script setup>
import { defineEmits } from "vue";
import { configs } from "../graphStyle.js";
//import * as vng from "v-network-graph";

// Initial graph
const nodes = {
  node1: { name: "Node 1", zxType: "boundary" },
  node2: { name: "Node 2", zxType: "z", zxAngle: "π/2" },
  node3: { name: "Node 3", zxType: "x" },
  node4: { name: "Node 4", zxType: "" },
};
const edges = {
  edge1: { source: "node1", target: "node2", zxType: "normal" },
  edge2: { source: "node2", target: "node3", zxType: "hadamard" },
  edge3: { source: "node3", target: "node4", zxType: "hadamard" },
  edge4: { source: "node3", target: "node4", zxType: "hadamard" },
};
const paths = {
  path1: { edges: ["edge1", "edge2", "edge3"] },
};

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

// Register emit events
const emit = defineEmits(["pan-start", "pan-stop"]);
</script>

<template>
  <vNetworkGraph
    @mousedown="mousedown"
    @mouseup="mouseup"
    @mouseout="mouseup"
    class="main-graph"
    ref="graphElem"
    :nodes="nodes"
    :edges="edges"
    :paths="paths"
    :configs="configs"
    :event-handlers="eventHandlers"
  />
</template>

<style scoped>
.main-graph {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
}
</style>
