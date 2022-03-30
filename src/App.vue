<script setup>
import { ref, computed, onMounted, onBeforeMount, onBeforeUnmount } from "vue";
import TheGraphView from "@/components/TheGraphView.vue";
import ThePanelOverlay from "@/components/ThePanelOverlay.vue";
import { usePanelStore } from "@/stores/panels.js";
import { useStyleStore } from "@/stores/graphStyle.js";
import { useUndoStore } from "@/stores/undoHistory.js";
import { useGraphStore } from "@/stores/graph.js";
import * as gops from "@/graphOps";

const panelStore = usePanelStore();
const styleStore = useStyleStore();
const undoStore = useUndoStore();
const graphStore = useGraphStore();
gops.graphOpsSetup();

const selectedNodes = ref([]);
const selectedEdges = ref([]);
const markedNodes = ref({ a: [], b: [] });

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
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", keydown);
});
const keydown = (e) => {
  if (e.target instanceof HTMLInputElement) {
    return;
  }
  let used = false;
  let k = e.key;
  if (!e.altKey && !e.ctrlKey && !e.metaKey) {
    // Allow backspace or 'x'
    if (k === "Backspace") {
      k = e.shiftKey ? "X" : "x";
    }
    used = command(k);
  } else if (e.metaKey ^ e.ctrlKey) {
    if (k === "z" && !e.shiftKey) {
      used = command("Undo");
    } else if ((k === "Z" && e.shiftKey) || (k === "y" && !e.shiftKey)) {
      used = command("Redo");
    }
  }
  if (used) {
    e.preventDefault();
    e.stopPropagation();
  }
};

// Undo/redo logic, accounting for nodes moved between edits
onMounted(() => {
  undoStore.addEntry(makeFullGraphStateCopy(), "init");
  wereNodesMoved.value = false;
});
const makeFullGraphStateCopy = (recordMode) => {
  const data = graphStore.fullCopy();
  data.selectedNodes = [...selectedNodes.value];
  data.selectedEdges = [...selectedEdges.value];
  if (recordMode) {
    data.rewriteMode = !!panelStore.rewriteMode;
  }
  return data;
};
const graphStateFullReplace = (data) => {
  graphStore.fullReplace(data);
  styleStore.view.layoutHandler.networkChanged();
  selectedNodes.value = [...data.selectedNodes];
  selectedEdges.value = [...data.selectedEdges];
  window.setTimeout(() => {
    selectedNodes.value = [...data.selectedNodes]; // Hack fix
    selectedEdges.value = [...data.selectedEdges];
  }, 0);
};
let wereNodesMoved = ref(false);
const graphStateUndo = () => {
  // Save any changes to node positions without clearing redo history
  if (wereNodesMoved.value) {
    undoStore.insertEntry(makeFullGraphStateCopy(), "move nodes");
    wereNodesMoved.value = false;
  }
  // Check if need to change mode before undoing
  const peek = undoStore.peek(0);
  if (
    peek &&
    (peek.rewriteMode === true || peek.rewriteMode === false) &&
    peek.rewriteMode !== !!panelStore.rewriteMode
  ) {
    panelStore.rewriteMode = peek.rewriteMode;
    return;
  }
  // Undo
  const data = undoStore.undo();
  if (data) {
    graphStateFullReplace(data);
  }
};
const graphStateRedo = () => {
  // Save any changes to node positions without clearing redo history
  if (wereNodesMoved.value) {
    undoStore.insertEntry(makeFullGraphStateCopy(), "move nodes");
    wereNodesMoved.value = false;
  }
  // Check if need to change mode before undoing
  const peek = undoStore.peek(1);
  if (
    peek &&
    (peek.rewriteMode === true || peek.rewriteMode === false) &&
    peek.rewriteMode !== !!panelStore.rewriteMode
  ) {
    panelStore.rewriteMode = peek.rewriteMode;
    return;
  }
  // Redo
  const data = undoStore.redo();
  if (data) {
    graphStateFullReplace(data);
  }
};
const nodeMove = () => {
  wereNodesMoved.value = true;
};
const recordBeforeGraphMod = () => {
  if (wereNodesMoved.value) {
    undoStore.addEntry(makeFullGraphStateCopy(), "move nodes");
    wereNodesMoved.value = false;
  }
};
const recordAfterGraphMod = (name) => {
  undoStore.addEntry(makeFullGraphStateCopy(true), name);
  wereNodesMoved.value = false;
};

// Execute graph commands
const command = (code) => {
  console.log(`Command: ${code}`);
  let used = true;
  if (!panelStore.rewriteMode) {
    // Edit mode
    switch (code) {
      case "n":
        recordBeforeGraphMod();
        addZNodes();
        recordAfterGraphMod("edit:add z nodes");
        break;
      case "b":
        recordBeforeGraphMod();
        addBoundaryNodes();
        recordAfterGraphMod("edit:add boundary nodes");
        break;
      case "e":
        recordBeforeGraphMod();
        gops.toggleEdges(selectedNodes.value);
        recordAfterGraphMod("edit:toggle edges");
        break;
      case "E":
        recordBeforeGraphMod();
        gops.clearEdgesBetweenNodes(selectedNodes.value);
        recordAfterGraphMod("edit:clear edges");
        break;
      case "x":
        recordBeforeGraphMod();
        deleteSelection();
        recordAfterGraphMod("edit: delete");
        break;
      case "a":
        recordBeforeGraphMod();
        setNodeAngles();
        recordAfterGraphMod("edit:set angle");
        break;
      case "s":
        recordBeforeGraphMod();
        gops.addPathByEdges(selectedEdges.value);
        recordAfterGraphMod("edit:add path");
        break;
      case "S":
        recordBeforeGraphMod();
        gops.clearPathsByEdges(selectedEdges.value);
        gops.clearPathsByNodes(selectedEdges.value);
        recordAfterGraphMod("edit:clear path");
        break;
      case "clear":
        recordBeforeGraphMod();
        clearGraph();
        recordAfterGraphMod("edit:clear");
        break;
      default:
        used = false;
        break;
    }
  } else {
    // Rewrite mode
    switch (code) {
      case "`":
        // For developer testing
        recordBeforeGraphMod();
        addZNodes();
        recordAfterGraphMod("rewrite:TEST");
        break;
      default:
        used = false;
        break;
    }
  }
  if (!used) {
    used = true;
    // All modes
    switch (code) {
      case "resetView":
        styleStore.extra.zoomLevel = 1;
        styleStore.graph?.panToCenter();
        break;
      case "Escape":
        // Clear selection
        selectedEdges.value = [];
        selectedNodes.value = [];
        break;
      case "Undo":
        graphStateUndo();
        break;
      case "Redo":
        graphStateRedo();
        break;
      default:
        used = false;
        break;
    }
  }
  if (used) {
    // Hack
    // When the graph is modified and the last-pressed button becomes disabled,
    // the button stops sending keydown events and all keyboard shortcuts stop
    // working.
    // This prevents that.
    window.setTimeout(() => {
      document.activeElement.disabled = false;
    }, 0);
  }
  return used;
};
const checkCanDoCommand = {
  // Edit mode
  n: ref(true),
  b: ref(true),
  e: computed(() => selectedNodes.value.length >= 2),
  E: computed(() => {
    let anyEdges = false;
    gops.forInnerEdgesOfNodes(selectedNodes.value, () => {
      anyEdges = true;
    });
    return anyEdges;
  }),
  x: computed(
    () => selectedNodes.value.length > 0 || selectedNodes.value.length > 0
  ),
  a: computed(() => selectedNodes.value.length >= 1),
  s: computed(() => gops.isEdgesValidPath(selectedEdges.value, true)),
  S: computed(() => {
    // Check if any edges are on a path
    let canDo = false;
    gops.forPathsOfEdges(selectedEdges.value, () => {
      canDo = true;
    });
    return canDo;
  }),
  clear: computed(() => Object.keys(graphStore.nodes).length >= 1),
  // Rewrite mode
  h: computed(() => {
    for (const node of selectedNodes.value) {
      if (!gops.isNodeNearBoundary(node) && gops.degree(node) == 2) return true;
    }
    return false;
  }),
  H: computed(() => {
    for (const node of selectedNodes.value) {
      if (!gops.isNodeNearBoundary(node)) return true;
    }
    return false;
  }),
  c: computed(() => {
    for (const node of selectedNodes.value) {
      if (!gops.isNodeNearBoundary(node) && gops.nodeIsPlusMinusPi2(node)) {
        return true;
      }
    }
    return false;
  }),
  C: computed(() => selectedNodes.value.length >= 1),
  p: computed(
    () =>
      selectedNodes.value.length == 2 &&
      !gops.isNodeNearBoundary(selectedNodes.value[0]) &&
      !gops.isNodeNearBoundary(selectedNodes.value[1])
  ),
  P: computed(() => false), // TODO: Check A, B, and A+B selections
  // All modes
  Escape: computed(
    () => selectedNodes.value.length > 0 || selectedNodes.value.length > 0
  ),
  Undo: computed(() => !undoStore.isBottomOfHistory() || wereNodesMoved.value),
  Redo: computed(() => !undoStore.isTopOfHistory()),
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
      x += styleStore.layout.distance;
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
      x += styleStore.layout.distance;
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
    for (const edge of selectedEdges.value) {
      select.push(...gops.nodesOfEdge(edge));
    }
    gops.deleteEdges(selectedEdges.value);
    selectedEdges.value = [];
    selectedNodes.value = select;
  }
};

const clearGraph = () => {
  gops.deleteNodes(Object.keys(graphStore.nodes));
  selectedEdges.value = [];
  selectedNodes.value = [];
};

const setNodeAngles = () => {
  gops.setAngle(
    selectedNodes.value.filter((n) => !gops.isBoundaryNode(n)),
    panelStore.angleToSet
  );
};
</script>

<template>
  <TheGraphView
    v-model:selectedNodes="selectedNodes"
    v-model:selectedEdges="selectedEdges"
    v-model:markedNodes="markedNodes"
    @pan-start="panstart"
    @pan-stop="panstop"
    @node-move="nodeMove"
  />
  <ThePanelOverlay
    :class="{ 'panel-inactive': overlayInactive }"
    :checkCanDoCommand="checkCanDoCommand"
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
