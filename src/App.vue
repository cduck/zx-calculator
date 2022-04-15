<script setup>
import {
  ref,
  toRef,
  computed,
  reactive,
  watch,
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
import { fromPyzxJson, toPyzxJson } from "@/graphConvertPyzx.js";
import { GraphRewrite } from "@/graphRewrite.js";
import * as angles from "@/angles.js";

const panelStore = usePanelStore();
const styleStore = useStyleStore();
const graphStore = useGraphStore();
const gops = new GraphOps(graphStore, (ns) =>
  styleStore.view.layoutHandler.findBestNodePositions(ns)
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

const modalVisible = ref(false);

// Disable overlay panels while panning
const overlayInactive = ref(false);
const panstart = () => {
  overlayInactive.value = true;
};
const panstop = () => {
  overlayInactive.value = false;
};
const resetView = () => {
  const numNodes = Object.keys(gops.graph.nodes).length;
  if (numNodes <= 0) {
    styleStore.extra.zoomLevel = 1;
    const { width, height } = styleStore.graph.svgPanZoom.getSizes();
    styleStore.graph.panTo({ x: width / 2, y: height / 2 });
  } else {
    styleStore.extra.zoomLevel = 1;
    styleStore.graph.panToCenter();
  }
};
const zoomToFit = (maxZoom) => {
  const numNodes = Object.keys(gops.graph.nodes).length;
  if (numNodes <= 0) {
    resetView();
    return;
  }
  styleStore.graph.panToCenter();
  const panelWidth = 200;
  const { width } = styleStore.graph.svgPanZoom.getSizes();
  let zoom =
    width < 4 * panelWidth ? 1 / 1.1 : (width - 2 * panelWidth) / width;
  styleStore.graph.svgPanZoom
    .fit()
    .zoomBy(zoom || 1 / 1.1)
    .center();
  const { realZoom } = styleStore.graph.svgPanZoom.getSizes();
  if (maxZoom && realZoom > maxZoom) {
    styleStore.graph.svgPanZoom.zoomBy(maxZoom / realZoom || 1);
  }
};

// Life cycle listeners
onBeforeMount(() => {
  loadConfig();
  watchConfig();
  window.addEventListener("keydown", keydown);
  document.addEventListener("paste", pasteOrDropHandler);
  document.addEventListener("copy", copyOrCutHandler);
  document.addEventListener("cut", copyOrCutHandler);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", keydown);
  styleStore.graph.svg.removeEventListener("dragenter", dragEnterHandler);
  styleStore.graph.svg.removeEventListener("dragover", dragOverHandler);
  styleStore.graph.svg.removeEventListener("dragleave", dragLeaveHandler);
  styleStore.graph.svg.removeEventListener("drop", pasteOrDropHandler);
  document.removeEventListener("paste", pasteOrDropHandler);
  document.removeEventListener("copy", copyOrCutHandler);
  document.removeEventListener("cut", copyOrCutHandler);
  undoStore.unload();
});
onMounted(() => {
  styleStore.graph.svg.addEventListener("dragenter", dragEnterHandler);
  styleStore.graph.svg.addEventListener("dragover", dragOverHandler);
  styleStore.graph.svg.addEventListener("dragleave", dragLeaveHandler);
  styleStore.graph.svg.addEventListener("drop", pasteOrDropHandler);
  undoStore.load();
  if (undoStore.isEmpty()) {
    undoStore.insertEntry(makeFullGraphStateCopy(), "init");
  }
  wereNodesMoved.value = false;
});

// Save some configuration
const watchConfig = () => {
  watch(toRef(panelStore, "rewriteMode"), saveConfig);
  watch(toRef(styleStore.view.grid, "visible"), saveConfig);
  watch(toRef(styleStore.view, "scalingObjects"), saveConfig);
  watch(styleStore.layout, saveConfig);
};
const saveConfig = () => {
  const config = {
    rewriteMode: panelStore.rewriteMode,
    gridVisible: styleStore.view.grid.visible,
    snapToGrid: styleStore.layout.snapToGrid,
    scaleNodes: styleStore.view.scalingObjects,
    forceLayout: styleStore.layout.forceLayout,
    fixBoundaries: styleStore.layout.fixBoundaries,
  };
  try {
    window.localStorage.setItem("zx-view-config", JSON.stringify(config));
  } catch (e) {
    console.warn("failed to save config:", e);
  }
};
const loadConfig = () => {
  let config;
  try {
    config = window.localStorage.getItem("zx-view-config");
    if (config) {
      config = JSON.parse(config);
    }
  } catch (e) {
    console.warn("failed to load config:", e);
  }
  if (!config || typeof config !== "object") return;
  let {
    rewriteMode,
    gridVisible,
    snapToGrid,
    scaleNodes,
    //forceLayout, // Don't load this setting because it changes node layouts
    fixBoundaries,
  } = config;
  panelStore.rewriteMode = rewriteMode ?? panelStore.rewriteMode;
  styleStore.view.grid.visible = gridVisible ?? styleStore.view.grid.visible;
  styleStore.layout.snapToGrid = snapToGrid ?? styleStore.layout.snapToGrid;
  styleStore.view.scalingObjects = scaleNodes ?? styleStore.view.scalingObjects;
  //styleStore.layout.forceLayout = forceLayout ?? styleStore.layout.forceLayout;
  styleStore.layout.fixBoundaries =
    fixBoundaries ?? styleStore.layout.fixBoundaries;
};

// Catch key strokes
const keydown = (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement
  ) {
    return;
  }
  let used = false;
  const code = e.which || e.charCode || e.keyCode || 0;
  let k =
    code < 32
      ? e.code || e.key
      : e.shiftKey
      ? String.fromCharCode(code).toUpperCase()
      : String.fromCharCode(code).toLowerCase();
  if (modalVisible.value) {
    if (k === "Escape") {
      // Press escape to close the modal view
      modalVisible.value = false;
      used = true;
    }
    // Don't run commands when a modal view is covering the graph
  } else {
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
      } else if (k === "a" && !e.shiftKey) {
        used = command("selectAll");
      }
    }
  }
  if (used) {
    e.preventDefault();
    e.stopPropagation();
  }
};
const dragOverlayVisible = ref(false);
const dragEnterHandler = (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    modalVisible.value
  ) {
    return;
  }
  e.dataTransfer.effectAllowed = "copy";
  dragOverlayVisible.value = true;
  e.preventDefault();
  e.stopPropagation();
};
const dragOverHandler = (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    modalVisible.value
  ) {
    return;
  }
  dragOverlayVisible.value = true;
  e.preventDefault();
  e.stopPropagation();
};
const dragLeaveHandler = (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    modalVisible.value
  ) {
    return;
  }
  dragOverlayVisible.value = false;
  e.preventDefault();
  e.stopPropagation();
};
const pasteOrDropHandler = (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    modalVisible.value
  ) {
    return;
  }
  dragOverlayVisible.value = false;
  const dataTransfer = e.clipboardData || e.dataTransfer;
  pasteDataTransfer(dataTransfer);
  e.preventDefault();
  e.stopPropagation();
};
const pasteDataTransfer = (dataTransfer) => {
  let gotContent = false;
  const pasteFile = (file) => {
    file.text().then(
      (str) => {
        paste(str);
      },
      (e) => {
        console.warn("failed to read pasted or dropped file:", e);
      }
    );
  };
  for (const file of dataTransfer.files) {
    pasteFile(file);
    gotContent = true;
    break; // Ignore any other files
  }
  if (!gotContent) {
    for (const item of dataTransfer.items) {
      if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) {
          pasteFile(file);
          gotContent = true;
          break;
        }
      } else if (item.type.match(/^text\/uri-list(\+|$)/)) {
        // Content is (multiple) URLs with #comments
        item.getAsString((uris) => {
          for (let uri of uris.split("\n")) {
            uri = uri.trim();
            if (uri.slice(0, 1) === "#") continue;
            paste(uri);
            break;
          }
        });
        gotContent = true;
        break;
      } else if (item.type.match(/^text\/html(\+|$)/)) {
        // Content is an HTML link
        item.getAsString((html) => {
          // Extract link from the first anchor in the HTML
          const htmlTag = new DOMParser().parseFromString(html, "text/html");
          const href = htmlTag.querySelector("a")?.href;
          if (href) {
            paste(href);
          } else {
            paste(htmlTag.innerText);
          }
        });
        gotContent = true;
        break;
      } else if (item.type.match(/^(text\/plain|application\/json)(\+|$)/)) {
        // Content is plain text
        item.getAsString((text) => {
          paste(text);
        });
        gotContent = true;
        break;
      } else {
        // Unknown, skip
      }
    }
  }
};
const copyOrCutHandler = (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    modalVisible.value
  ) {
    return;
  }
  if (panelStore.rewriteMode && e.type === "cut") {
    // Don't cut in rewrite mode
    return;
  }
  if (selectedNodes.value.length <= 0) {
    // No nodes to copy
    return;
  }
  const dataTransfer = e.clipboardData || e.dataTransfer;
  let copyData;
  if (e.type === "cut") {
    recordBeforeGraphMod();
    copyData = cut(selectedNodes.value);
    recordAfterGraphMod("edit:cut");
  } else {
    copyData = copy(selectedNodes.value);
  }
  const { str, title } = copyData;
  const strWithComment = `#${title}\n${str}`;
  const aTag = document.createElement("a");
  aTag.href = str;
  aTag.innerText = title;
  const strWithHtml = aTag.outerHTML;
  dataTransfer.items.add(strWithComment, "text/uri-list");
  dataTransfer.items.add(strWithHtml, "text/html");
  dataTransfer.items.add(str, "text/plain");
  e.preventDefault();
  e.stopPropagation();
};

// Undo/redo logic, accounting for nodes moved between edits
const graphSummary = (data) => {
  const numNodes = Object.keys(data?.nodes || {}).length;
  const numEdges = Object.keys(data?.edges || {}).length;
  return `${numNodes} node${numNodes === 1 ? "" : "s"}, ${numEdges} edge${
    numEdges === 1 ? "" : "s"
  }`;
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
  selectedNodes.value = (data?.selectedNodes ?? []).filter(
    (n) => graphStore.nodes[n]
  );
  selectedEdges.value = (data?.selectedEdges ?? []).filter(
    (e) => graphStore.edges[e]
  );
  window.setTimeout(() => {
    // Hack fix
    selectedNodes.value = (data?.selectedNodes ?? []).filter(
      (n) => graphStore.nodes[n]
    );
    selectedEdges.value = (data?.selectedEdges ?? []).filter(
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
  wereNodesMoved.value = false;
};
const graphStateUndo = () => {
  // Save any changes to node positions without clearing redo history
  if (wereNodesOrEdgesSelected()) {
    undoStore.insertEntry(makeFullGraphStateCopy(), "select nodes", 0, true);
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
    wereNodesMoved.value = false;
  }
};
const graphStateRedo = () => {
  // Save any changes to node positions without clearing redo history
  if (wereNodesOrEdgesSelected()) {
    undoStore.insertEntry(makeFullGraphStateCopy(), "select nodes", 0, true);
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
    wereNodesMoved.value = false;
  }
};
const updateNodesMaybeMoved = () => {
  if (wereNodesMoved.value) {
    undoStore.updateEntry(makeFullGraphStateCopy(), "move nodes");
  } else {
    undoStore.insertEntry(makeFullGraphStateCopy(), "move nodes");
  }
  wereNodesMoved.value = true;
};
watch(toRef(styleStore.layout, "forceLayout"), (newForce) => {
  if (!newForce) {
    updateNodesMaybeMoved();
  }
});
const nodeMove = () => {
  overlayInactive.value = false;
  updateNodesMaybeMoved();
  delete paste.pasteContent;
};
const nodeMoveStart = () => {
  overlayInactive.value = true;
};
const recordBeforeGraphMod = () => {
  if (wereNodesOrEdgesSelected()) {
    undoStore.insertEntry(makeFullGraphStateCopy(), "select nodes", 0, true);
    wereNodesMoved.value = false;
  }
};
const recordAfterGraphMod = (name) => {
  undoStore.addEntry(makeFullGraphStateCopy(true), name);
  wereNodesMoved.value = false;
};
const edgeMultiClick = (detail) => {
  document.activeElement.blur();
  const e = detail.event;
  if (detail.count === 1) {
    if (e?.shiftKey || e?.metaKey || e?.shiftKey) {
      const newEdges = selectedEdges.value.filter((e) => e !== detail.edge);
      if (newEdges.length === selectedEdges.value.length) {
        newEdges.push(detail.edge);
      }
      selectedEdges.value = newEdges;
    } else if (selectedEdges.value.indexOf(detail.edge) < 0) {
      selectedEdges.value = [detail.edge];
    }
  } else if (detail.count > 1) {
    selectMultiNeighborhood(gops.nodesOfEdge(detail.edge), detail.count - 2);
  }
};
const nodeMultiClick = (detail) => {
  document.activeElement.blur();
  const e = detail.event;
  if (detail.count === 1) {
    if (e.altKey) {
      selectedNodes.value = selectedNodes.value.filter(
        (n) => n !== detail.node
      );
    } else if (e.shiftKey || e.metaKey || e.shiftKey) {
      const newNodes = selectedNodes.value.filter((n) => n !== detail.node);
      if (newNodes.length === selectedNodes.value.length) {
        newNodes.push(detail.node);
      }
      selectedNodes.value = newNodes;
    } else if (selectedNodes.value.indexOf(detail.node) < 0) {
      selectedNodes.value = [detail.node];
    }
  } else if (detail.count > 1) {
    if (detail.count - 1 !== nodeMultiClick.prevCount) {
      if (selectedNodes.value.indexOf(detail.node) >= 0) {
        nodeMultiClick.distDelay = detail.count - 1;
      } else {
        nodeMultiClick.distDelay = detail.count;
      }
    }
    const dist = detail.count - nodeMultiClick.distDelay;
    selectMultiNeighborhood([detail.node], dist, e.altKey);
    nodeMultiClick.prevCount = detail.count;
  }
};
const selectMultiNeighborhood = (nodes, distance, deselect) => {
  nodes = new Set(nodes);
  let newNodes;
  for (let i = 0; i < distance; i++) {
    newNodes = new Set();
    gops.forEdgesOfNodes(nodes, (edge) => {
      const [n1, n2] = gops.nodesOfEdge(edge);
      newNodes.add(n1);
      newNodes.add(n2);
    });
    nodes = newNodes;
  }
  if (deselect) {
    nodes = selectedNodes.value.filter((n) => !nodes.has(n));
  } else {
    for (const n of selectedNodes.value) {
      nodes.add(n);
    }
  }
  selectedEdges.value = [];
  selectedNodes.value = [...nodes];
  window.setTimeout(() => {
    selectedEdges.value = [];
    selectedNodes.value = [...nodes];
  }, 0);
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
          try {
            newEdges.push(...grewrite.removeHEdgeWithDegree2Nodes(e));
          } catch (e) {
            console.warn(e.message);
          }
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
          try {
            middleEdges.push(grewrite.hEdgeToTwoNodes(e)[1][1]);
          } catch (e) {
            console.warn(e.message);
          }
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
          try {
            mergedNodes.push(grewrite.removeDegree2NodeWithHEdges(n));
          } catch (e) {
            console.warn(e.message);
          }
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
          try {
            newNodes.push(
              grewrite.splitNode(
                undefined,
                selectedEdges.value,
                panelStore.angleToSplit
              )
            );
          } catch (e) {
            console.warn(e.message);
          }
        } else {
          for (const n of selectedNodes.value) {
            try {
              newNodes.push(
                grewrite.splitNode(n, "all", panelStore.angleToSplit)
              );
            } catch (e) {
              console.warn(e.message);
            }
          }
        }
        selectedNodes.value = newNodes;
        selectedEdges.value = [];
        recordAfterGraphMod("rewrite:split node");
        break;
      }
      case "v":
      case "c": // Complementation
        recordBeforeGraphMod();
        if (selectedNodes.value.length === 1) {
          let nodes;
          try {
            nodes = grewrite.localComplementation(selectedNodes.value[0]);
          } catch (e) {
            console.error(e.message);
          }
          selectedNodes.value = nodes;
          selectedEdges.value = [];
          window.setTimeout(() => {
            selectedNodes.value = nodes; // Hack
          }, 0);
        }
        recordAfterGraphMod("rewrite:complementation");
        break;
      case "C": {
        // Reverse complementation
        recordBeforeGraphMod();
        const newNode = grewrite.revLocalComplementation(selectedNodes.value);
        selectedNodes.value = [newNode];
        selectedEdges.value = [];
        recordAfterGraphMod("rewrite:reverse complementation");
        break;
      }
      case "V": {
        // Reverse complementation (negative pi/2 angle)
        recordBeforeGraphMod();
        const newNode = grewrite.revLocalComplementation(
          selectedNodes.value,
          true
        );
        selectedNodes.value = [newNode];
        selectedEdges.value = [];
        recordAfterGraphMod("rewrite:reverse complementation (-π/2)");
        break;
      }
      case "o":
      case "p": {
        // Pivot
        recordBeforeGraphMod();
        const nodes = grewrite.pivot(selectedEdges.value[0]);
        selectedEdges.value = [];
        selectedNodes.value = nodes;
        recordAfterGraphMod("rewrite:pivot");
        break;
      }
      case "P": // Reverse pivot
        reversePivotStep1Or2(false);
        break;
      case "O": // Reverse pivot (pi angle)
        reversePivotStep1Or2(true);
        break;
      case "x": {
        // Delete temporary pivot node
        recordBeforeGraphMod();
        const pNodes = selectedNodes.value.filter(
          (n) => gops.nodeType(n) === "pivotA"
        );
        if (pNodes.length !== selectedNodes.value.length) break;
        // Delete nodes and select their neighborhood
        const select = [];
        gops.forNodeCollectiveNeighborhood(pNodes, (node) => select.push(node));
        gops.deleteNodes(pNodes);
        selectedNodes.value = select;
        window.setTimeout(() => {
          selectedNodes.value = select; // Hack fix
        }, 0);
        recordAfterGraphMod("edit:delete");
        break;
      }
      default:
        used = false;
        break;
    }
  }
  if (!used) {
    used = true;
    // All modes
    switch (code) {
      case "fitView":
        zoomToFit();
        break;
      case "resetView":
        resetView();
        break;
      case "realign":
        recordBeforeGraphMod();
        styleStore.view.layoutHandler.findBestNodePositions(
          Object.keys(gops.graph.nodes),
          true,
          true
        );
        recordAfterGraphMod("move nodes (realign to grid)");
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
      case "selectAll":
        if (selectedEdges.value.length > 0) {
          selectedEdges.value = Object.keys(gops.graph.edges);
          selectedNodes.value = [];
        } else {
          selectedEdges.value = [];
          selectedNodes.value = Object.keys(gops.graph.nodes);
        }
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
  v: computed(() => checkCanDoCommand.c.value),
  C: computed(() => {
    if (selectedNodes.value.length < 1) return false;
    return grewrite.revLocalComplementationIsValid(selectedNodes.value);
  }),
  V: computed(() => checkCanDoCommand.C.value),
  p: computed(
    () =>
      selectedEdges.value.length == 1 &&
      grewrite.pivotIsValid(selectedEdges.value[0])
  ),
  o: computed(() => checkCanDoCommand.p),
  P1: computed(
    () =>
      selectedNodes.value.length >= 1 &&
      grewrite.revPivotStep1IsValid(selectedNodes.value)
  ),
  P2: computed(() => grewrite.revPivotStep2IsValid(selectedNodes.value)),
  P: computed(() => checkCanDoCommand.P1.value || checkCanDoCommand.P2.value),
  O: computed(() => checkCanDoCommand.P),
  // All modes
  Escape: computed(
    () => selectedNodes.value.length > 0 || selectedEdges.value.length > 0
  ),
  Undo: computed(
    () => !undoStore.isBottomOfHistory() || wereNodesOrEdgesSelected()
  ),
  Redo: computed(() => !undoStore.isTopOfHistory()),
  selectAll: ref(true),
  fitView: ref(true),
  resetView: ref(true),
  realign: ref(true),
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

const deleteSelection = (nodes) => {
  nodes = nodes ?? selectedNodes.value;
  if (nodes.length > 0) {
    // Delete nodes and select their neighborhood
    const select = [];
    gops.forNodeCollectiveNeighborhood(nodes, (node) => {
      select.push(node);
    });
    gops.deleteNodes(nodes);
    selectedNodes.value = select; // Gets cleared due to the deletion somehow
    window.setTimeout(() => {
      selectedNodes.value = select; // Hack fix
    }, 0);
    delete paste.pasteContent;
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

const cut = (nodes) => {
  const ret = copy(nodes);
  recordBeforeGraphMod();
  deleteSelection(nodes);
  recordAfterGraphMod("edit:cut");
  delete paste.pasteContent;
  return ret;
};
const copy = (nodes) => {
  const ser = serialize(graphStore, nodes);
  const copyStr = `${window.location.origin}${window.location.pathname}#${ser}`;
  if (copyStr !== paste.pasteContent) {
    paste.pasteContent = copyStr;
    paste.pasteCount = 1;
  }
  const numNodes = Object.keys(nodes).length;
  let numEdges = 0;
  gops.forInnerEdgesOfNodes(nodes, () => (numEdges += 1));
  return {
    str: copyStr,
    title: `ZX Diagram with ${numNodes} node${
      numNodes === 1 ? "" : "s"
    } and ${numEdges} edge${numEdges === 1 ? "" : "s"}`,
  };
};
const paste = (pasteStr) => {
  // Check if paste string is a graph or something else
  const hashIndex = pasteStr.indexOf("#");
  const bracketIndex = pasteStr.indexOf("{");
  if (typeof pasteStr !== "string" || (hashIndex < 0 && bracketIndex !== 0)) {
    return;
  }
  // Avoid node name conflicts
  let max = -1;
  for (const n of Object.keys(graphStore.nodes)) {
    const di = n.indexOf("$");
    if (n.slice(0, 2) === "cp" && di >= 0) {
      const val = Math.ceil(Number(n.slice(2, di)));
      if (isFinite(val) && val > max) {
        max = val;
      }
    }
  }
  // Deserialize
  const prefixI = max + 1;
  if (pasteStr !== paste.pasteContent) {
    paste.pasteCount = 0;
  }
  const offsetX = styleStore.layout.grid * 2 * (paste.pasteCount ?? 0);
  const offsetY = offsetX;
  let data;
  if (bracketIndex === 0) {
    // Parse from PyZX JSON
    try {
      data = fromPyzxJson(
        pasteStr,
        styleStore.layout.distance,
        `cp${prefixI}$`,
        offsetX,
        offsetY
      );
    } catch (e) {
      console.error("Graph parse from paste PyZX JSON failed:", e.message || e);
      return;
    }
  } else {
    // Parse from URL encoding
    try {
      const ser = decodeURIComponent(pasteStr.slice(hashIndex + 1));
      data = deserialize(ser, `cp${prefixI}$`, offsetX, offsetY);
    } catch (e) {
      console.error("Graph parse from paste URL failed:", e.message || e);
      return;
    }
  }
  paste.pasteContent = pasteStr;
  paste.pasteCount = (paste.pasteCount ?? 0) + 1;
  // Add to graph
  recordBeforeGraphMod();
  Object.assign(graphStore.nodes, data.nodes);
  Object.assign(graphStore.edges, data.edges);
  Object.assign(graphStore.paths, data.paths);
  Object.assign(graphStore.layouts.nodes, data.layouts.nodes);
  selectedNodes.value = Object.keys(data.nodes);
  selectedEdges.value = [];
  recordAfterGraphMod(`edit:paste`);
  return true;
};

const reversePivotStep1Or2 = (addPi) => {
  recordBeforeGraphMod();
  let step;
  if (checkCanDoCommand.P2.value) {
    // Pivot step 2
    const edge = grewrite.revPivotStep2(selectedNodes.value, addPi);
    step = 2;
    selectedEdges.value = [edge];
    selectedNodes.value = [];
  } else {
    // Pivot step 1
    const node = grewrite.revPivotStep1(selectedNodes.value, addPi);
    step = 1;
    selectedEdges.value = [];
    selectedNodes.value = [node];
  }
  recordAfterGraphMod(`rewrite:reverse pivot (step ${step})`);
};

// Import and export graph
const importErrorMsg = ref("");
const importPyzx = (str) => {
  let data;
  try {
    data = fromPyzxJson(str, styleStore.layout.distance);
  } catch (e) {
    console.error("failed to load PyZX JSON:", e.message || e);
    importErrorMsg.value = e.message || `${e}`;
    return;
  }
  if (data) {
    recordBeforeGraphMod();
    graphStateFullReplace(data);
    recordAfterGraphMod("import:pyzx json");
    modalVisible.value = false;
  }
};

const pyzxJsonStr = ref("");
const exportPyzx = () => {
  updateNodesMaybeMoved();
  pyzxJsonStr.value = toPyzxJson(
    graphStore,
    undefined,
    styleStore.layout.distance
  );
};

const svgOutStrGet = () => {
  // Get the permalink
  updateNodesMaybeMoved();
  const permalink =
    location.href.split("#", 1)[0] + undoStore._urlFragment(graphStore);
  // Get SVG content
  return [getAsSvg(styleStore.graph, permalink)];
};
// Modified from
// https://github.com/dash14/v-network-graph/blob/ad20e27f9caf1763952356ccbc3bc63355a445d8/src/components/VNetworkGraph.vue#L719
const getAsSvg = (vgraph, permalink) => {
  const element = vgraph.svg;
  const viewport = vgraph.viewport;
  const target = element.cloneNode(true);
  const box = viewport.getBBox();
  const z = 1 / vgraph.scale;
  const svg = {
    x: Math.floor((box.x - 10) * z),
    y: Math.floor((box.y - 10) * z),
    width: Math.ceil((box.width + 20) * z),
    height: Math.ceil((box.height + 20) * z),
  };
  target.setAttribute("width", svg.width.toString());
  target.setAttribute("height", svg.height.toString());
  const v = target.querySelector(".v-viewport");
  const vb = target.querySelector(".v-background-viewport");
  v.setAttribute("transform", `translate(${-svg.x} ${-svg.y}), scale(${z})`);
  v.removeAttribute("style");
  if (vb) {
    vb.setAttribute("transform", `translate(${-svg.x} ${-svg.y}), scale(${z})`);
    vb.removeAttribute("style");
  }
  target.setAttribute("viewBox", `0 0 ${svg.width} ${svg.height}`);
  // Add link
  const a = document.createElement("a");
  a.href = permalink;
  const r = document.createElement("rect");
  r.setAttribute("width", "100%");
  r.setAttribute("height", "100%");
  r.setAttribute("fill", "black");
  r.setAttribute("stroke", "none");
  r.setAttribute("opacity", 0);
  a.appendChild(r);
  for (const child of [...target.childNodes]) {
    target.removeChild(child);
    a.appendChild(child);
  }
  target.appendChild(a);
  let data = target.outerHTML;
  // cleanup
  data = data.replaceAll(/ data-v-[0-9a-z]+=""/g, "");
  data = data.replaceAll(/<!--[\s\S]*?-->/gm, "");
  return data;
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
    @node-move-start="nodeMoveStart"
    @node-multi-click="nodeMultiClick"
    @edge-multi-click="edgeMultiClick"
    @view-load="() => zoomToFit(1)"
  />
  <div :class="{ 'panel-inactive': overlayInactive }">
    <ThePanelOverlay
      :checkCanDoCommand="checkCanDoCommand"
      @command="command"
      @importPyzx="importPyzx"
      @exportPyzx="exportPyzx"
      :pyzxJsonOutStr="pyzxJsonStr"
      :svgOutStrGet="svgOutStrGet"
      v-model:importErrorMsg="importErrorMsg"
      v-model:modalVisible="modalVisible"
      :dragoverVisible="dragOverlayVisible"
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
