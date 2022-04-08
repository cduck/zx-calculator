<script setup>
import {
  ref,
  computed,
  reactive,
  onMounted,
  onBeforeMount,
  onBeforeUnmount,
} from "vue";
import TheGraphView from "@/components/TheGraphView.vue";
import ThePanelOverlay from "@/components/ThePanelOverlay.vue";
import { usePanelStore } from "@/stores/panels.js";
import { useStyleStore } from "@/stores/graphStyle.js";
import { useGraphStore } from "@/stores/graph.js";
import { UndoHistory } from "@/undo.js";
import { GraphOps } from "@/graphOps.js";
import { serialize, deserialize } from "@/graphSerial.js";
import { GraphRewrite } from "@/graphRewrite.js";
import * as angles from "@/angles.js";

const panelStore = usePanelStore();
const styleStore = useStyleStore();
const graphStore = useGraphStore();
const gops = new GraphOps(graphStore, (ns) =>
  styleStore.view.layoutHandler.setNewNodePositions(ns)
);
const grewrite = new GraphRewrite(gops);
const undoStore = reactive(
  new UndoHistory({
    maxHistory: 0,
    linkToBrowser: true,
    serialize: serialize,
    deserialize: deserialize,
    title: (data, name, inHistory) =>
      "ZX Calculator — " +
      (inHistory ? `${graphSummary(data)}, ${name}` : graphSummary(data)),
  })
);

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

// Life cycle listeners
onBeforeMount(() => {
  window.addEventListener("keydown", keydown);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", keydown);
  undoStore.unload();
});
onMounted(() => {
  undoStore.load();
  if (undoStore.isEmpty()) {
    undoStore.addEntry(makeFullGraphStateCopy(), "init", true);
  }
  wereNodesMoved.value = false;
});

// Catch key strokes
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
const graphSummary = (data) => {
  const numNodes = Object.keys(data.nodes).length;
  const numEdges = Object.keys(data.edges).length;
  return `${numNodes} nodes, ${numEdges} edges`;
};
const makeFullGraphStateCopy = (recordMode) => {
  const data = graphStore.fullCopy();
  data.selectedNodes = [...selectedNodes.value];
  data.selectedEdges =
    data.selectedNodes.length <= 0 ? [...selectedEdges.value] : [];
  if (recordMode) {
    data.rewriteMode = !!panelStore.rewriteMode;
  }
  return data;
};
const graphStateFullReplace = (data) => {
  selectedNodes.value = [];
  selectedEdges.value = [];
  graphStore.fullReplace(data);
  styleStore.view.layoutHandler.networkChanged();
  selectedNodes.value = (data.selectedNodes ?? []).filter(
    (n) => graphStore.nodes[n]
  );
  selectedEdges.value = (data.selectedEdges ?? []).filter(
    (e) => graphStore.edges[e]
  );
  window.setTimeout(() => {
    // Hack fix
    selectedNodes.value = (data.selectedNodes ?? []).filter(
      (n) => graphStore.nodes[n]
    );
    selectedEdges.value = (data.selectedEdges ?? []).filter(
      (e) => graphStore.edges[e]
    );
  }, 0);
};
let wereNodesMoved = ref(false);
const areSetsEqual = (set1, set2) => {
  if (set1.size !== set2.size) return false;
  for (const v of set1) {
    if (!set2.has(v)) return false;
  }
  return true;
};
const wereNodesOrEdgesSelected = () => {
  const peek = undoStore.peek(0);
  if (peek) {
    return (
      !areSetsEqual(
        new Set(selectedNodes.value),
        new Set(peek.selectedNodes)
      ) ||
      !areSetsEqual(new Set(selectedEdges.value), new Set(peek.selectedEdges))
    );
  } else {
    return selectedNodes.value.length > 0 || selectedEdges.value.length > 0;
  }
};
undoStore.browserNavigateCallback = (data) => {
  // Don't save any changes to node positions
  // Change mode
  if (
    data &&
    (data.rewriteMode === true || data.rewriteMode === false) &&
    data.rewriteMode !== !!panelStore.rewriteMode
  ) {
    panelStore.rewriteMode = data.rewriteMode;
  }
  // Update graph
  graphStateFullReplace(data);
};
const graphStateUndo = () => {
  // Save any changes to node positions without clearing redo history
  if (wereNodesMoved.value || wereNodesOrEdgesSelected()) {
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
  if (wereNodesMoved.value || wereNodesOrEdgesSelected()) {
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
  if (wereNodesMoved.value || wereNodesOrEdgesSelected()) {
    undoStore.insertEntry(makeFullGraphStateCopy(), "move nodes");
    wereNodesMoved.value = false;
  }
};
const recordAfterGraphMod = (name) => {
  undoStore.addEntry(makeFullGraphStateCopy(true), name);
  wereNodesMoved.value = false;
};

// Execute graph commands
const command = (code) => {
  const canDo = checkCanDoCommand[code]?.value;
  if (canDo === undefined) return false;
  if (!canDo) return true;
  console.log(`Command: ${code}`);
  let used = true;
  if (!panelStore.rewriteMode) {
    // Edit mode
    switch (code) {
      case "n": {
        recordBeforeGraphMod();
        const name = addZNodes();
        recordAfterGraphMod(`edit:${name}`);
        break;
      }
      case "b":
        recordBeforeGraphMod();
        addBoundaryNodes();
        recordAfterGraphMod("edit:new boundary node");
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
        recordAfterGraphMod("edit:delete");
        break;
      case "a":
        recordBeforeGraphMod();
        setNodeAngles();
        recordAfterGraphMod("edit:set angle");
        break;
      case "A":
        recordBeforeGraphMod();
        addNodeAngles();
        recordAfterGraphMod("edit:add angle");
        break;
      case "s":
        recordBeforeGraphMod();
        gops.addPathByEdges(selectedEdges.value);
        recordAfterGraphMod("edit:new path");
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
        recordAfterGraphMod("edit:clear graph");
        break;
      default:
        used = false;
        break;
    }
  } else {
    // Rewrite mode
    switch (code) {
      case "h": {
        // Hadamard cancellation
        recordBeforeGraphMod();
        const newEdges = [];
        for (const e of selectedEdges.value) {
          newEdges.push(...grewrite.removeHEdgeWithDegree2Nodes(e));
        }
        selectedEdges.value = newEdges;
        selectedNodes.value = [];
        window.setTimeout(() => {
          selectedEdges.value = newEdges; // Hack
        }, 0);
        recordAfterGraphMod("rewrite:hadamard cancellation");
        break;
      }
      case "H": {
        // Reverse Hadamard cancellation
        const middleEdges = [];
        recordBeforeGraphMod();
        for (const e of selectedEdges.value) {
          middleEdges.push(grewrite.hEdgeToTwoNodes(e)[1][1]);
        }
        selectedEdges.value = middleEdges;
        selectedNodes.value = [];
        window.setTimeout(() => {
          selectedEdges.value = middleEdges; // Hack
        }, 0);
        recordAfterGraphMod("rewrite:reverse hadamard cancellation");
        break;
      }
      case "j": {
        // Hadamard cancellation / merge node
        recordBeforeGraphMod();
        const mergedNodes = [];
        for (const n of selectedNodes.value) {
          mergedNodes.push(grewrite.removeDegree2NodeWithHEdges(n));
        }
        selectedNodes.value = mergedNodes;
        selectedEdges.value = [];
        window.setTimeout(() => {
          selectedNodes.value = mergedNodes; // Hack
        }, 0);
        recordAfterGraphMod("rewrite:merge node");
        break;
      }
      case "J": {
        // Split node
        recordBeforeGraphMod();
        try {
          panelStore.angleToSplit = angles.cleanInputStr(
            panelStore.angleToSplit
          );
        } catch {
          panelStore.angleToSplit = "";
        }
        const newNodes = [];
        if (selectedEdges.value.length > 0) {
          newNodes.push(
            grewrite.splitNode(
              undefined,
              selectedEdges.value,
              panelStore.angleToSplit
            )
          );
        } else {
          for (const n of selectedNodes.value) {
            newNodes.push(
              grewrite.splitNode(n, undefined, panelStore.angleToSplit)
            );
          }
        }
        selectedNodes.value = newNodes;
        selectedEdges.value = [];
        recordAfterGraphMod("rewrite:split node");
        break;
      }
      case "c": // Complementation
        recordBeforeGraphMod();
        if (selectedNodes.value.length === 1) {
          const nodes = grewrite.localComplementation(selectedNodes.value[0]);
          selectedNodes.value = nodes;
          selectedEdges.value = [];
        }
        recordAfterGraphMod("rewrite:complementation");
        break;
      case "C": // Reverse complementation
        recordBeforeGraphMod();
        //grewrite.(selectedNodes.value);
        recordAfterGraphMod("rewrite:reverse complementation");
        break;
      case "p": // Pivot
        recordBeforeGraphMod();
        //grewrite.(selectedNodes.value);
        recordAfterGraphMod("rewrite:pivot");
        break;
      case "P": // Reverse pivot
        recordBeforeGraphMod();
        //grewrite.(selectedNodes.value);
        recordAfterGraphMod("rewrite:reverse pivot");
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
    () => selectedNodes.value.length > 0 || selectedEdges.value.length > 0
  ),
  a: computed(() => {
    try {
      angles.cleanInputStr(panelStore.angleToSet || "0");
    } catch (e) {
      return false;
    }
    for (const node of selectedNodes.value) {
      if (!gops.isBoundaryNode(node)) return true;
    }
    return false;
  }),
  A: computed(() => {
    if (!panelStore.angleToAdd) {
      return false;
    }
    try {
      angles.cleanInputStr(panelStore.angleToAdd);
    } catch (e) {
      return false;
    }
    for (const node of selectedNodes.value) {
      if (!gops.isBoundaryNode(node)) return true;
    }
    return false;
  }),
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
    for (const edge of selectedEdges.value) {
      if (grewrite.removeHEdgeWithDegree2NodesIsValid(edge)) return true;
    }
    return false;
  }),
  H: computed(() => {
    for (const edge of selectedEdges.value) {
      if (grewrite.hEdgeToTwoNodesIsValid(edge)) return true;
    }
    return false;
  }),
  j: computed(() => {
    for (const node of selectedNodes.value) {
      if (grewrite.removeDegree2NodeWithHEdgesIsValid(node)) return true;
    }
    return false;
  }),
  J: computed(() => {
    if (grewrite.splitNodeIsValid(undefined, selectedEdges.value)) return true;
    for (const n of selectedNodes.value) {
      if (grewrite.splitNodeIsValid(n)) return true;
    }
    return false;
  }),
  c: computed(() => {
    if (selectedNodes.value.length !== 1) return false;
    return grewrite.localComplementationIsValid(selectedNodes.value[0]);
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
  Undo: computed(
    () =>
      !undoStore.isBottomOfHistory() ||
      wereNodesMoved.value ||
      wereNodesOrEdgesSelected()
  ),
  Redo: computed(() => !undoStore.isTopOfHistory()),
  resetView: ref(true),
};

// Graph edit commands that adjust or use the selections before operating on the
// graph
const addZNodes = () => {
  if (selectedEdges.value.length > 0) {
    // For convenience, replace each edge with a new connected node
    const newNodes = [];
    for (const edge of selectedEdges.value) {
      newNodes.push(...gops.insertNewNodesAlongEdge(edge, 1)[0]);
    }
    selectedEdges.value = [];
    selectedNodes.value = newNodes;
    return "insert z node";
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
    return "new z node";
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
  try {
    panelStore.angleToSet = angles.cleanInputStr(panelStore.angleToSet);
  } catch (e) {
    return;
  }
  for (const n of selectedNodes.value) {
    if (!gops.isBoundaryNode(n)) {
      gops.setAngle(n, panelStore.angleToSet);
    }
  }
};

const addNodeAngles = () => {
  try {
    panelStore.angleToAdd = angles.cleanInputStr(panelStore.angleToAdd);
  } catch (e) {
    return;
  }
  if (!panelStore.angleToAdd) {
    return;
  }
  for (const n of selectedNodes.value) {
    if (!gops.isBoundaryNode(n)) {
      gops.addAngle(n, panelStore.angleToAdd);
    }
  }
};
</script>

<template>
  <TheGraphView
    :graph="graphStore"
    v-model:selectedNodes="selectedNodes"
    v-model:selectedEdges="selectedEdges"
    v-model:markedNodes="markedNodes"
    @pan-start="panstart"
    @pan-stop="panstop"
    @node-move="nodeMove"
  />
  <div :class="{ 'panel-inactive': overlayInactive }">
    <ThePanelOverlay
      :checkCanDoCommand="checkCanDoCommand"
      @command="command"
    />
  </div>
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
