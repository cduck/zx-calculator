<script setup>
import { ref, onBeforeMount, onBeforeUnmount } from "vue";
import TheGraphView from "@/components/TheGraphView.vue";
import ThePanelOverlay from "@/components/ThePanelOverlay.vue";
import { usePanelStore } from "@/stores/panels.js";
import { useStyleStore } from "@/stores/graphStyle.js";
import * as gops from "@/graphOps";

const panelStore = usePanelStore();
const styleStore = useStyleStore();
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
  window.addEventListener("keydown", keydown);
  window.addEventListener("keyup", keyup);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", keydown);
  window.removeEventListener("keyup", keyup);
});
let metaKey = false; // Meta key  is not treated as a modifier by browsers
const keydown = (e) => {
  if (e.key === "Meta") {
    metaKey = true;
  }
};
const keyup = (e) => {
  if (e.key === "Meta") {
    metaKey = false;
  }
  if (e.target instanceof HTMLInputElement) {
    return;
  }
  let used = false;
  if (!e.altKey && !e.ctrlKey && !e.metaKey && !metaKey) {
    let k = e.key;
    // Allow backspace or 'x'
    if (k === "Backspace") {
      k = e.shiftKey ? "X" : "x";
    }
    used = command(k);
  } else if (metaKey || e.ctrlKey) {
    if (e.which === 90 && !e.shiftKey) {
      used = command("Undo");
    } else if (
      (e.which == 90 && e.shiftKey) ||
      (e.which == 89 && !e.shiftKey)
    ) {
      used = command("Redo");
    }
  }
  if (used) {
    e.preventDefault();
    e.stopPropagation();
  }
};

// Execute graph commands
const command = (code) => {
  console.log(`Command: ${code}`);
  let used = true;
  if (!panelStore.rewriteMode) {
    // Edit mode
    switch (code) {
      case "n":
        addZNodes();
        break;
      case "b":
        addBoundaryNodes();
        break;
      case "e":
        gops.toggleEdges(selectedNodes.value);
        break;
      case "E":
        gops.clearEdgesBetweenNodes(selectedNodes.value);
        break;
      case "x":
        deleteSelection();
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
        used = false;
        break;
    }
  } else {
    // Rewrite mode
    switch (code) {
      default:
        used = false;
        break;
    }
  }
  if (!used) {
    used = true;
    // All modes
    switch (code) {
      case "Escape":
        // Clear selection
        selectedEdges.value = [];
        selectedNodes.value = [];
        break;
      default:
        used = false;
        break;
    }
  }
  return used;
};

// Graph edit commands that adjust or use the selections before operating on the
// graph
const addZNodes = () => {
  if (selectedEdges.value.length > 0) {
    // For convenience, replace each edge with a new connected node
    const newNodes = [];
    for (const edge of selectedEdges.value) {
      newNodes.push(...gops.insertNewNodesAlongEdge(edge, 1));
    }
    selectedEdges.value = [];
    selectedNodes.value = newNodes;
  } else {
    let x, y;
    if (selectedNodes.value.length > 0) {
      [x, y] = gops.coordsOfNode(selectedNodes.value[0]);
      console.log(x, y);
      x += styleStore.extra.defaultOffset;
      console.log(x, y);
    }
    const node = gops.addZNode(x, y);
    // For convenience, connect each previously selected node to the new node
    for (const n of selectedNodes.value) {
      if (gops.isBoundaryNode(n)) {
        gops.addNormalEdge(n, node);
      } else {
        gops.addHadamardEdge(n, node);
      }
    }
    // For convenience, change the selection to just the new node
    selectedNodes.value = [node];
  }
};

const addBoundaryNodes = () => {
  if (selectedNodes.value.length > 0) {
    const edges = [];
    for (const n of selectedNodes.value) {
      let [x, y] = gops.coordsOfNode(n);
      x += styleStore.extra.defaultOffset;
      const node = gops.addBoundaryNode(x, y);
      edges.push(gops.addNormalEdge(n, node));
      selectedNodes.value = [];
      selectedEdges.value = edges;
    }
  } else {
    const node = gops.addBoundaryNode();
    selectedNodes.value = [node];
    selectedEdges.value = [];
  }
};

const deleteSelection = () => {
  if (selectedNodes.value.length > 0) {
    // Delete nodes and select their neighborhood
    const select = [];
    gops.forNodeCollectiveNeighborhood(selectedNodes.value, (node) => {
      select.push(node);
    });
    gops.deleteNodes(selectedNodes.value);
    selectedNodes.value = select; // Gets cleared due to the deletion somehow
    window.setTimeout(() => {
      selectedNodes.value = select; // Hack fix
    }, 0);
  } else {
    // Delete edges and select their nodes
    const select = [];
    console.log(selectedEdges.value);
    for (const edge of selectedEdges.value) {
      console.log(edge);
      select.push(...gops.nodesOfEdge(edge));
    }
    gops.deleteEdges(selectedEdges.value);
    selectedEdges.value = [];
    selectedNodes.value = select;
  }
};

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
