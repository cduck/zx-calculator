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
import { GraphUpdateController } from "@/graphConfigurableLayout.js";
import { GraphOps } from "@/graphOps.js";
import {
  serialize,
  deserialize,
  serializeAll,
  deserializeAll,
} from "@/graphSerial.js";
import { fromPyzxJson, toPyzxJson } from "@/graphConvertPyzx.js";
import { GraphRewrite, GraphRewriteException } from "@/graphRewrite.js";
import * as angles from "@/angles.js";
import { SoundEffects } from "@/sound.js";

const panelStore = usePanelStore();
const styleStore = useStyleStore();
const graphStore = useGraphStore();
const graphUpdater = new GraphUpdateController(
  styleStore.layout,
  () => {
    styleStore.view.layoutHandler.networkChanged();
    return styleStore.view.layoutHandler;
  },
  (selNodes, selEdges) => setSelectionCallback(selNodes, selEdges)
);
const gops = new GraphOps(graphStore, (ns) =>
  styleStore.view.layoutHandler.findBestNodePositions(
    ns,
    undefined,
    undefined,
    gops.graph.layouts.nodes,
    gops.graph.nodes
  )
);
const grewrite = new GraphRewrite(gops);
const undoStore = reactive(
  new UndoHistory({
    maxHistory: 0,
    linkToBrowser: true,
    serialize: (data) => serializeWithSnapshots(data),
    deserialize: (str) => deserializeWithSnapshots(str),
    title: (data, name, inHistory) =>
      "ZX Calculator — " +
      (inHistory ? `${graphSummary(data)}, ${name}` : graphSummary(data)),
  })
);
let snapshotI = 0;
const snapshotGraphs = ref(reactive([]));
const sound = new SoundEffects(false);
const soundEnabled = toRef(sound, "enabled");

const selectedNodes = ref([]);
const selectedEdges = ref([]);
const markedNodes = ref({ a: [], b: [] });

const modalVisible = ref(false);
const helpVisible = ref(false);

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
  const panelHeight = snapshotGraphs.value.length > 0 ? 250 : 50;
  const { width, height } = styleStore.graph.svgPanZoom.getSizes();
  const zoom1 =
    width < 4 * panelWidth ? 1 / 1.1 : (width - 2 * panelWidth) / width;
  const zoom2 =
    height < 3 * panelHeight ? 1 / 1.1 : (height - panelHeight) / height;
  const zoom = zoom1 < zoom2 ? zoom1 : zoom2;
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
  styleStore.graph.viewport.removeEventListener("touchstart", touchstartOnce);
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
  styleStore.graph.viewport.addEventListener("touchstart", touchstartOnce);
  undoStore.load(graphStore.fullCopy());
  wereNodesMoved.value = false;
  if (Object.keys(graphStore.nodes).length <= 0) {
    helpVisible.value = true;
  }
});

// Detect touch device (changes selection behavior)
let noShiftSelect = undefined;
const touchstartOnce = () => {
  noShiftSelect = noShiftSelect ?? true;
  window.removeEventListener("touchstart", touchstartOnce);
};

// Save some configuration
const watchConfig = () => {
  watch(toRef(panelStore, "rewriteMode"), saveConfig);
  watch(toRef(styleStore.view.grid, "visible"), saveConfig);
  watch(toRef(styleStore.view, "scalingObjects"), saveConfig);
  watch(styleStore.layout, saveConfig);
  watch(soundEnabled, saveConfig);
};
const saveConfig = () => {
  const config = {
    rewriteMode: panelStore.rewriteMode,
    gridVisible: styleStore.view.grid.visible,
    snapToGrid: styleStore.layout.snapToGrid,
    scaleNodes: styleStore.view.scalingObjects,
    forceLayout: styleStore.layout.forceLayout,
    fixBoundaries: styleStore.layout.fixBoundaries,
    soundEffects: soundEnabled.value,
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
    soundEffects,
  } = config;
  panelStore.rewriteMode = rewriteMode ?? panelStore.rewriteMode;
  styleStore.view.grid.visible = gridVisible ?? styleStore.view.grid.visible;
  styleStore.layout.snapToGrid = snapToGrid ?? styleStore.layout.snapToGrid;
  styleStore.view.scalingObjects = scaleNodes ?? styleStore.view.scalingObjects;
  //styleStore.layout.forceLayout = forceLayout ?? styleStore.layout.forceLayout;
  styleStore.layout.fixBoundaries =
    fixBoundaries ?? styleStore.layout.fixBoundaries;
  soundEnabled.value = soundEffects ?? soundEnabled.value;
};

// Catch key strokes
const keydown = (e) => {
  let used = false;
  const code = e.which || e.charCode || e.keyCode || 0;
  let k =
    code < 32 || code > 127
      ? e.code || e.key
      : e.shiftKey
      ? String.fromCharCode(code).toUpperCase()
      : String.fromCharCode(code).toLowerCase();
  const onInput =
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement;
  if (modalVisible.value && !onInput) {
    if (k === "Escape") {
      // Press escape to close the modal view
      modalVisible.value = false;
      used = true;
    }
    // Don't run commands when a modal view is covering the graph
  }
  if (
    !e.altKey &&
    !e.ctrlKey &&
    !e.metaKey &&
    !onInput &&
    !modalVisible.value
  ) {
    // Allow backspace or 'x'
    if (k === "Backspace") {
      k = e.shiftKey ? "X" : "x";
    }
    // Single key commands
    used = command(k);
  } else if (e.metaKey ^ e.ctrlKey && !e.altKey) {
    // (Shift)+letter shortcuts
    if (k === "s") {
      command("save");
      used = true;
    } else if (k === "o" && !e.shiftKey) {
      command("open");
      modalVisible.value = false;
      used = true;
    } else if (!onInput && !modalVisible.value) {
      // Shortcuts that should be allowed their defaults when not used
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
    e.dataTransfer.dropEffect = "none";
    e.preventDefault();
    return;
  }
  e.dataTransfer.dropEffect = "copy";
  dragOverlayVisible.value = !panelStore.rewriteMode;
  e.preventDefault();
  e.stopPropagation();
};
const dragOverHandler = (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    modalVisible.value
  ) {
    e.preventDefault();
    return;
  }
  dragOverlayVisible.value = !panelStore.rewriteMode;
  e.preventDefault();
  e.stopPropagation();
};
const dragLeaveHandler = (e) => {
  if (
    e.target instanceof HTMLInputElement ||
    e.target instanceof HTMLTextAreaElement ||
    modalVisible.value
  ) {
    dragOverlayVisible.value = false;
    e.preventDefault();
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
    dragOverlayVisible.value = false;
    return;
  }
  if (panelStore.rewriteMode) {
    dragOverlayVisible.value = false;
    e.preventDefault();
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
      } else if (item.type.match(/^text\/uri-list/)) {
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
      } else if (item.type.match(/^text\/html/)) {
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
      } else if (item.type.match(/^(text\/plain|application\/json)/)) {
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
    e.preventDefault();
    return;
  }
  if (selectedNodes.value.length <= 0) {
    // No nodes to copy
    e.preventDefault();
    return;
  }
  const dataTransfer = e.clipboardData || e.dataTransfer;
  let copyData;
  if (e.type === "cut") {
    copyData = cut(selectedNodes.value);
  } else {
    copyData = copy(selectedNodes.value);
  }
  const { url, title } = copyData;
  const strWithComment = `#${title}\n${url}`;
  const aTag = document.createElement("a");
  aTag.href = url;
  aTag.innerText = title;
  const strWithHtml = aTag.outerHTML;
  dataTransfer.items.add(strWithComment, "text/uri-list");
  dataTransfer.items.add(strWithHtml, "text/html");
  dataTransfer.items.add(url, "text/plain");
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
const makeFullGraphStateCopy = (recordMode, selNodes, selEdges) => {
  graphUpdater.writeBackNodePositions();
  const data = graphStore.fullCopy();
  data.selectedNodes = [...(selNodes ?? selectedNodes.value)];
  data.selectedEdges =
    data.selectedNodes.length <= 0
      ? [...(selEdges ?? selectedEdges.value)]
      : [];
  if (recordMode) {
    data.rewriteMode = !!panelStore.rewriteMode;
  }
  return data;
};
const graphStateFullReplace = (data) => {
  graphStore.fullReplace(data);
  gops.resetAnimationLog();
  const selNodes = (data?.selectedNodes ?? []).filter(
    (n) => graphStore.nodes[n]
  );
  const selEdges = (data?.selectedEdges ?? []).filter(
    (e) => graphStore.edges[e]
  );
  graphUpdater.cancelAnimation(graphStore, selNodes, selEdges);
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
  // Close any overlays
  modalVisible.value = false;
};
const setSelectionCallback = (selNodes, selEdges, noTimeout) => {
  selectedNodes.value = selNodes;
  selectedEdges.value = selEdges;
  window.clearTimeout(setSelectionCallback.id);
  if (!noTimeout) {
    setSelectionCallback.id = window.setTimeout(() => {
      // Fix if graph viewer clears selection after graph change
      selectedNodes.value = selNodes;
      selectedEdges.value = selEdges;
    }, 0);
  }
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
  graphUpdater.writeBackNodePositions();
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
  gops.resetAnimationLog();
};
const recordAfterGraphMod = (name, data, selNodes, selEdges) => {
  data = data ?? makeFullGraphStateCopy(true, selNodes, selEdges);
  const anim = gops.animSpec;
  anim.selectedNodes = selNodes ?? selectedNodes.value;
  anim.selectedEdges = selEdges ?? selectedEdges.value;
  graphUpdater.updateGraph(graphStore, anim);
  gops.resetAnimationLog();
  undoStore.addEntry(data, name);
  wereNodesMoved.value = false;
};
const appendSnapshot = (data) => {
  data.label = "";
  data.id = `snapshot${snapshotI}`;
  data.isNew = true;
  snapshotI += 1;
  snapshotGraphs.value.push(data);
  undoStore.updateUrl();
};
const snapshotSelect = (g) => {
  recordBeforeGraphMod();
  graphStateFullReplace(g);
  recordAfterGraphMod(
    "restore snapshot" + (g.label ? ` (${g.label})` : ""),
    g,
    g.selectedNodes,
    g.selectedEdges
  );
};
const snapshotLabelChange = () => {
  undoStore.updateUrl();
};
const snapshotDelete = (g) => {
  const len = snapshotGraphs.value.length;
  snapshotGraphs.value = snapshotGraphs.value.filter((item) => item !== g);
  if (snapshotGraphs.value.length !== len) {
    undoStore.updateUrl();
  }
};
const edgeMultiClick = (detail) => {
  graphUpdater.cancelSelectionRestore();
  document.activeElement.blur();
  const e = detail.event;
  if (!graphStore.edges[detail.edge]) return;
  if (detail.count === 1) {
    if (e?.shiftKey || e?.metaKey || e?.ctrlKey || noShiftSelect) {
      const newEdges = selectedEdges.value.filter((e) => e !== detail.edge);
      if (newEdges.length === selectedEdges.value.length) {
        newEdges.push(detail.edge);
      }
      setSelectionCallback([], newEdges, true);
    } else if (selectedEdges.value.indexOf(detail.edge) < 0) {
      setSelectionCallback([], [detail.edge], true);
    }
  } else if (detail.count > 1) {
    selectMultiNeighborhood(gops.nodesOfEdge(detail.edge), detail.count - 2);
  }
};
const nodeMultiClick = (detail) => {
  graphUpdater.cancelSelectionRestore();
  document.activeElement.blur();
  const e = detail.event;
  if (!graphStore.nodes[detail.node]) return;
  if (detail.count === 1) {
    if (e.altKey) {
      setSelectionCallback(
        selectedNodes.value.filter((n) => n !== detail.node),
        [],
        true
      );
    } else if (e.shiftKey || e.metaKey || e.ctrlKey || noShiftSelect) {
      const newNodes = selectedNodes.value.filter((n) => n !== detail.node);
      if (newNodes.length === selectedNodes.value.length) {
        newNodes.push(detail.node);
      }
      setSelectionCallback(newNodes, [], true);
    } else if (selectedNodes.value.indexOf(detail.node) < 0) {
      setSelectionCallback([detail.node], [], true);
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
  setSelectionCallback([...nodes], []);
};

// Execute graph commands
const command = (code) => {
  const canDoAny = checkCanDoCommand[code]?.value;
  if (canDoAny === undefined) return false;
  const canDo =
    checkCanDoCommandOther[code]?.value ||
    (panelStore.rewriteMode
      ? checkCanDoCommandRewrite[code]?.value
      : checkCanDoCommandEdit[code]?.value);
  if (!canDo) return true;
  console.log(`Command: ${code}`);
  graphUpdater.cancelAnimation();
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
      case "m": {
        // Add X node instead
        recordBeforeGraphMod();
        const name = addZNodes(true);
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
      case "r":
        recordBeforeGraphMod();
        if (selectedEdges.value.length > 0) {
          for (const e of selectedEdges.value) {
            gops.toggleEdgeColor(e);
          }
        } else {
          toggleNodeColors();
        }
        recordAfterGraphMod("edit:toggle color");
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
      case "r":
        recordBeforeGraphMod();
        toggleNodeColors();
        recordAfterGraphMod("rewrite:toggle color");
        break;
      case "g":
      case "h": {
        // Hadamard cancellation
        recordBeforeGraphMod();
        const newEdges = [];
        let newNodes = [];
        for (const e of selectedEdges.value) {
          try {
            if (gops.isHadamardEdge(e)) {
              newEdges.push(...grewrite.removeHEdgeWithDegree2Nodes(e));
            } else {
              newNodes.push(grewrite.mergeNEdge(e));
            }
          } catch (e) {
            console.warn(e.message);
          }
        }
        if (newEdges.length > 0) {
          newNodes = [];
        }
        setSelectionCallback(newNodes, newEdges);
        recordAfterGraphMod("rewrite:hadamard cancellation");
        break;
      }
      case "H": // Reverse Hadamard cancellation
        reverseHadamardCancellation(false);
        break;
      case "G": // Reverse Hadamard cancellation (Using X node)
        reverseHadamardCancellation(true);
        break;
      case "k":
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
        setSelectionCallback(mergedNodes, []);
        recordAfterGraphMod("rewrite:merge node");
        break;
      }
      case "J": // Split node
        splitNodes(false);
        break;
      case "K": // Split node (Using X node)
        splitNodes(true);
        break;
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
          setSelectionCallback(nodes, []);
        }
        recordAfterGraphMod("rewrite:complementation");
        break;
      case "C": {
        // Reverse complementation
        recordBeforeGraphMod();
        const newNode = grewrite.revLocalComplementation(selectedNodes.value);
        setSelectionCallback([newNode], []);
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
        setSelectionCallback([newNode], []);
        recordAfterGraphMod("rewrite:reverse complementation (-π/2)");
        break;
      }
      case "o":
      case "p": {
        // Pivot
        recordBeforeGraphMod();
        const nodes = grewrite.pivot(selectedEdges.value[0]);
        setSelectionCallback(nodes, []);
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
        setSelectionCallback(select, []);
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
      case "snapshot":
        appendSnapshot(makeFullGraphStateCopy());
        break;
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
          true,
          gops.graph.layouts.nodes,
          gops.graph.nodes
        );
        recordAfterGraphMod("move nodes (realign to grid)");
        break;
      case "Escape":
        // Clear selection
        setSelectionCallback([], []);
        break;
      case "Undo":
        graphStateUndo();
        break;
      case "Redo":
        graphStateRedo();
        break;
      case "selectAll":
        if (selectedEdges.value.length > 0) {
          setSelectionCallback([], Object.keys(gops.graph.edges));
        } else {
          setSelectionCallback(Object.keys(gops.graph.nodes), []);
        }
        break;
      case "save":
        save();
        break;
      case "open":
        open();
        break;
      case "Backquote":
        soundEnabled.value = !soundEnabled.value;
        break;
      default:
        used = false;
        break;
    }
  }
  if (used) {
    sound.action(code);
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
const checkCanDoCommandEdit = {
  // Edit mode
  n: ref(true),
  m: ref(true),
  b: ref(true),
  e: computed(() => selectedNodes.value.length >= 2),
  E: computed(() => {
    let anyEdges = false;
    gops.forInnerEdgesOfNodes(selectedNodes.value, () => {
      anyEdges = true;
    });
    return anyEdges;
  }),
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
  rEdit: computed(() => {
    if (selectedEdges.value.length > 0) return true;
    if (selectedNodes.value.length <= 0) {
      for (const n of Object.keys(graphStore.nodes)) {
        if (gops.isZOrXNode(n)) return true;
      }
      return false;
    }
    for (const n of selectedNodes.value) {
      if (gops.isZOrXNode(n)) return true;
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
};
const checkCanDoCommandRewrite = {
  // Rewrite mode
  rRewrite: computed(() => {
    if (selectedEdges.value.length <= 0 && selectedNodes.value.length <= 0) {
      for (const n of Object.keys(graphStore.nodes)) {
        if (gops.isZOrXNode(n)) return true;
      }
      return false;
    }
    for (const n of selectedNodes.value) {
      if (grewrite.toggleNodeColorIsValid(n)) return true;
    }
    return false;
  }),
  h: computed(() => {
    for (const edge of selectedEdges.value) {
      if (gops.isHadamardEdge(edge)) {
        if (grewrite.removeHEdgeWithDegree2NodesIsValid(edge)) return true;
      } else {
        if (grewrite.mergeNEdgeIsValid(edge)) return true;
      }
    }
    return false;
  }),
  H: computed(() => {
    for (const edge of selectedEdges.value) {
      if (grewrite.edgeToOneOrTwoNodesIsValid(edge)) return true;
    }
    return false;
  }),
  G: computed(() => checkCanDoCommand.H),
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
  K: computed(() => checkCanDoCommand.J),
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
};
const checkCanDoCommandOther = {
  // Mainly edit mode but allowed for deleting temp pivot nodes in rewrite mode
  x: computed(
    () => selectedNodes.value.length > 0 || selectedEdges.value.length > 0
  ),
  // All modes
  r: computed(() =>
    panelStore.rewriteMode
      ? checkCanDoCommand.rRewrite
      : checkCanDoCommand.rEdit
  ),
  snapshot: computed(() => Object.keys(graphStore.nodes).length >= 1),
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
  save: ref(true),
  open: ref(true),
  Backquote: ref(true),
};
const checkCanDoCommand = {
  ...checkCanDoCommandEdit,
  ...checkCanDoCommandRewrite,
  ...checkCanDoCommandOther,
};

// Graph edit commands that adjust or use the selections before operating on the
// graph
const addZNodes = (addX) => {
  if (selectedEdges.value.length > 0) {
    // For convenience, replace each edge with a new connected node
    const newNodes = [];
    const t = addX ? "x" : "z";
    for (const edge of selectedEdges.value) {
      newNodes.push(...gops.insertNewNodesAlongEdge(edge, 1, undefined, t)[0]);
    }
    setSelectionCallback(newNodes, []);
    return `insert ${t} node`;
  } else {
    let x, y, x2;
    if (selectedNodes.value.length > 0) {
      [x, y] = gops.locationXY(selectedNodes.value[0]);
      x2 = x + styleStore.layout.distance;
    }
    const node = addX
      ? gops.addXNode(x2, y, undefined, undefined, x, y)
      : gops.addZNode(x2, y, undefined, undefined, x, y);
    // For convenience, connect each previously selected node to the new node
    for (const n of selectedNodes.value) {
      if (gops.isBoundaryNode(n)) {
        gops.addNormalEdge(n, node, x !== undefined);
      } else {
        gops.addHadamardEdge(n, node, x !== undefined);
      }
    }
    // For convenience, change the selection to just the new node
    setSelectionCallback([node], []);
    return addX ? "new x node" : "new z node";
  }
};

const addBoundaryNodes = () => {
  if (selectedNodes.value.length > 0) {
    const edges = [];
    for (const n of selectedNodes.value) {
      let [x, y] = gops.locationXY(n);
      const x2 = x + styleStore.layout.distance;
      const node = gops.addBoundaryNode(x2, y, undefined, undefined, x, y);
      edges.push(gops.addNormalEdge(n, node, true));
      setSelectionCallback([], edges);
    }
  } else {
    const node = gops.addBoundaryNode();
    setSelectionCallback([node], []);
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
    setSelectionCallback(select, []);
    delete paste.pasteContent;
  } else {
    // Delete edges and select their nodes
    const select = [];
    for (const edge of selectedEdges.value) {
      select.push(...gops.nodesOfEdge(edge));
    }
    gops.deleteEdges(selectedEdges.value);
    setSelectionCallback(select, []);
  }
};

const clearGraph = () => {
  gops.deleteNodes(Object.keys(graphStore.nodes));
  setSelectionCallback([], []);
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

const toggleNodeColors = () => {
  let nodes = selectedNodes.value;
  if (nodes.length <= 0) {
    nodes = Object.keys(graphStore.nodes).filter((n) => gops.isXNode(n));
  }
  if (nodes.length <= 0) {
    nodes = Object.keys(graphStore.nodes).filter((n) => gops.isZNode(n));
  }
  for (const n of nodes) {
    try {
      grewrite.toggleNodeColor(n);
    } catch (e) {
      if (!(e instanceof GraphRewriteException)) throw e;
    }
  }
  setSelectionCallback(nodes, []);
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
  graphUpdater.writeBackNodePositions();
  const ser = serialize(graphStore, nodes);
  const copyStr = `${window.location.origin}${window.location.pathname}#${ser}`;
  if (copyStr !== paste.pasteContent) {
    paste.pasteContent = copyStr;
    paste.pasteCount = 1;
  }
  const numNodes = nodes.length;
  let numEdges = 0;
  gops.forInnerEdgesOfNodes(nodes, () => (numEdges += 1));
  return {
    url: copyStr,
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
  setSelectionCallback(Object.keys(data.nodes), []);
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
    setSelectionCallback([], [edge]);
  } else {
    // Pivot step 1
    const node = grewrite.revPivotStep1(selectedNodes.value, addPi);
    step = 1;
    setSelectionCallback([node], []);
  }
  recordAfterGraphMod(`rewrite:reverse pivot (step ${step})`);
};

const reverseHadamardCancellation = (useX) => {
  const middleEdges = [];
  recordBeforeGraphMod();
  for (const e of selectedEdges.value) {
    try {
      middleEdges.push(grewrite.edgeToOneOrTwoNodes(e, useX ? "x" : "z"));
    } catch (e) {
      if (!(e instanceof GraphRewriteException)) throw e;
    }
  }
  setSelectionCallback([], middleEdges);
  recordAfterGraphMod("rewrite:reverse hadamard cancellation");
};

const splitNodes = (useX) => {
  recordBeforeGraphMod();
  try {
    panelStore.angleToSplit = angles.cleanInputStr(panelStore.angleToSplit);
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
          panelStore.angleToSplit,
          useX ? "x" : "z"
        )
      );
    } catch (e) {
      console.warn(e.message);
    }
  } else {
    for (const n of selectedNodes.value) {
      try {
        newNodes.push(
          grewrite.splitNode(
            n,
            "all",
            panelStore.angleToSplit,
            useX ? "x" : "z"
          )
        );
      } catch (e) {
        console.warn(e.message);
      }
    }
  }
  setSelectionCallback(newNodes, []);
  recordAfterGraphMod("rewrite:split node");
};

// Import and export graph
const serializeWithSnapshots = (data) => {
  return serializeAll(data, snapshotGraphs.value);
};
const deserializeWithSnapshots = (str) => {
  deserializeWithSnapshots.i = (deserializeWithSnapshots.i ?? -1) + 1;
  const { g, s } = deserializeAll(str, `l${deserializeWithSnapshots.i}#`);
  snapshotGraphs.value = s || [];
  return g;
};

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
const pyzxJsonFname = ref("");
const saveFname = () => {
  const numNodes = Object.keys(graphStore.nodes).length;
  const numEdges = Object.keys(graphStore.edges).length;
  return `zx-graph-${numNodes}n-${numEdges}e.pyzx.json`;
};
const exportPyzx = () => {
  updateNodesMaybeMoved();
  pyzxJsonStr.value = toPyzxJson(
    graphStore,
    undefined,
    styleStore.layout.distance
  );
  pyzxJsonFname.value = saveFname();
};
const save = () => {
  updateNodesMaybeMoved();
  const pyzxJson = toPyzxJson(
    graphStore,
    undefined,
    styleStore.layout.distance
  );
  const fname = saveFname();
  if (!pyzxJson) {
    return;
  }
  const file = new Blob([pyzxJson], {
    type: "application/json",
  });
  const blobUrl = URL.createObjectURL(file);
  try {
    const aTag = document.createElement("a");
    aTag.download = fname;
    aTag.rel = "noopener";
    aTag.target = "_blank";
    aTag.href = blobUrl;
    aTag.dispatchEvent(new MouseEvent("click"));
  } catch (e) {
    console.error("Error saving graph to file:", e.message || e);
  } finally {
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  }
};
const open = () => {
  if (!open.input) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json,text/json,.txt,text/plain";
    input.addEventListener("input", () => {
      if (input.files.length > 0) {
        input.files[0].text().then(importPyzx);
      }
    });
    open.input = input;
  }
  open.input.dispatchEvent(new MouseEvent("click"));
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
    :graph="graphUpdater.displayGraph"
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
      :snapshotGraphs="snapshotGraphs"
      @snapshotSelect="snapshotSelect"
      @snapshotLabelChange="snapshotLabelChange"
      @snapshotDelete="snapshotDelete"
      @importPyzx="importPyzx"
      @exportPyzx="exportPyzx"
      :pyzxJsonOutStr="pyzxJsonStr"
      :pyzxJsonOutFname="pyzxJsonFname"
      :svgOutStrGet="svgOutStrGet"
      v-model:importErrorMsg="importErrorMsg"
      v-model:modalVisible="modalVisible"
      v-model:helpVisible="helpVisible"
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
