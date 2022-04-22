// Custom layout with optional force and grid
// Significantly modified from v-network-graph ForceLayout
// https://github.com/dash14/v-network-graph/blob/0862692061da4a5d2ab212210e9f5f067621e4fb/src/layouts/force.ts

import { toRef, watch, reactive } from "vue";
import { Config } from "v-network-graph";
import * as d3 from "d3-force";

const DEFAULT_OPTIONS = {
  snapToGrid: false,
  grid: 10,
  distance: 50,
  newNodePositionMargin: 0, // Defaults to "distance"
  forceLayout: true,
  fixBoundaries: true,
  positionFixedByClickWithAltKey: true, // Doesn't really work yet
  animDuration: 300, // Milliseconds, used by GraphUpdateController
};

export class GraphUpdateController {
  constructor(options, updateCallback) {
    this.options = options;
    for (const [k, v] of Object.entries(DEFAULT_OPTIONS)) {
      if (this.options[k] === undefined) {
        this.options[k] = v;
      }
    }
    this.updateCallback = updateCallback;
    this.animQueue = [];

    this.displayGraph = {
      nodes: reactive({}),
      edges: reactive({}),
      paths: reactive({}),
      layouts: {
        nodes: reactive({}),
      },
    };

    this.targetGraph = {
      nodes: {},
      edges: {},
      paths: {},
      layouts: {
        nodes: {},
      },
    };
  }

  updateGraph(data, animSpec) {
    overwriteDict(this.targetGraph.nodes, data.nodes);
    overwriteDict(this.targetGraph.edges, data.edges);
    overwriteDict(this.targetGraph.paths, data.paths);
    overwriteDict(this.targetGraph.layouts.nodes, data.layouts.nodes);

    if (animSpec && animSpec.needsAnimation()) {
      // Queue animation
      console.log("animate", animSpec);
      this.animQueue.push(animSpec);
      if (this.animQueue.length === 1) {
        // Start animation frames
        this._startAnimation();
      }
    } else if (this.animQueue.length <= 0) {
      // Update instantly
      overwriteDict(this.displayGraph.nodes, data.nodes);
      overwriteDict(this.displayGraph.edges, data.edges);
      overwriteDict(this.displayGraph.paths, data.paths);
      overwriteDict(this.displayGraph.layouts.nodes, data.layouts.nodes);
      if (this.updateCallback) this.updateCallback();
    }
  }

  cancelAnimation(newData) {
    this.animQueue = [];
    this.updateGraph(newData);
  }

  _startAnimation() {
    const state = this.animQueue[0].getAnimationState(this.displayGraph);
    state.applyAnimationStart();
    if (this.updateCallback) this.updateCallback();
    this._startRequestAnimationFrame(state);
  }

  _finishAnimation() {
    overwriteDict(this.displayGraph.nodes, this.targetGraph.nodes);
    overwriteDict(this.displayGraph.edges, this.targetGraph.edges);
    overwriteDict(this.displayGraph.paths, this.targetGraph.paths);
    overwriteDict(
      this.displayGraph.layouts.nodes,
      this.targetGraph.layouts.nodes
    );
    if (this.updateCallback) this.updateCallback();
  }

  _startRequestAnimationFrame(state) {
    let startTime;
    const duration = this.options.animDuration;
    const callback = (timestamp) => {
      if (this.animQueue.length <= 0) {
        this._finishAnimation();
        return;
      }
      if (startTime === undefined) {
        startTime = timestamp;
      }
      const timeIn = timestamp - startTime;
      if (timeIn < duration) {
        state.applyAnimationStep(easeOut(timeIn, duration, 0, 1));
      } else {
        state.applyAnimationEnd();
      }
      if (this.updateCallback) this.updateCallback();

      if (timeIn >= duration) {
        this.animQueue.splice(0, 1);
        if (this.animQueue.length <= 0) {
          this._finishAnimation();
        } else {
          this._startAnimation();
        }
      } else {
        window.requestAnimationFrame(callback);
      }
    };
    window.requestAnimationFrame(callback);
  }
}

export class ConfigurableLayout {
  constructor(options) {
    this.options = options;
    for (const [k, v] of Object.entries(DEFAULT_OPTIONS)) {
      if (this.options[k] === undefined) {
        this.options[k] = v;
      }
    }

    watch(toRef(this.options, "fixBoundaries"), () => this.networkChanged());
    watch(toRef(this.options, "forceLayout"), () => this.forceLayoutChanged());
  }

  activate(parameters) {
    this.deactivate();
    this.getParameters = () => parameters;
    const { nodes, edges, emitter } = parameters;

    this.buildNodeLayouts();
    this.stopNetworkWatch = watch(
      () => [Object.keys(nodes.value), edges.value],
      () => this.networkChanged(),
      { deep: true }
    );

    this.simulation = this.createSimulation(
      this.nodeLayouts,
      this.forceLayoutEdges(edges.value)
    );
    if (!this.options.forceLayout) {
      this.simulation.stop();
    }

    this.onDragCallback = (ps) => this.onDrag(ps);
    this.onDragEndCallback = (ps) => this.onDragEnd(ps);
    this.onClickCallback = (ps) => this.onClick(ps);
    emitter.on("node:dragstart", this.onDragCallback);
    emitter.on("node:pointermove", this.onDragCallback);
    emitter.on("node:dragend", this.onDragEndCallback);
    emitter.on("node:click", this.onClickCallback);

    this.restartSimulation();
  }

  onDrag(positions) {
    const { layouts } = this.getParameters();
    for (const [id, pos] of Object.entries(positions)) {
      const layout = this.getOrCreateNodePosition(layouts, id);
      if (!this.options.forceLayout || this.isNodeFixed(id)) {
        this.snapPosition(pos);
      }
      this.setNodePosition(layout, pos);
      // Fix during drag in force layout
      const nodePos = this.nodeLayoutMap[id];
      nodePos.fx = pos.x;
      nodePos.fy = pos.y;
    }
    this.restartSimulation();
  }

  onDragEnd(positions) {
    const { layouts } = this.getParameters();
    for (const [id, pos] of Object.entries(positions)) {
      const layout = this.getOrCreateNodePosition(layouts, id);
      if (!this.options.forceLayout || this.isNodeFixed(id)) {
        this.snapPosition(pos);
      }
      this.setNodePosition(layout, pos);
      const nodePos = this.nodeLayoutMap[id];
      if (this.isNodeFixed(id)) {
        nodePos.fx = pos.x;
        nodePos.fy = pos.y;
      } else {
        nodePos.x = pos.x;
        nodePos.y = pos.y;
        delete nodePos.fx;
        delete nodePos.fy;
      }
    }
    this.restartSimulation();
  }

  onClick({ node, event }) {
    const { layouts } = this.getParameters();
    if (this.options.positionFixedByClickWithAltKey && event.altKey) {
      const layout = this.getOrCreateNodePosition(layouts, node);
      let nodePos = this.nodeLayoutMap?.[node];
      if (!nodePos) {
        nodePos = { id: node, x: 0, y: 0 };
        this.nodeLayoutMap[node] = nodePos;
      }
      if (this.isNodeFixed(node)) {
        // Set not fixed
        layout.value.fixed = false;
        layouts[node].fixed = false;
      } else {
        layout.value.fixed = true;
        layouts[node].fixed = true;
      }
      if (this.isNodeFixed(node)) {
        nodePos.fx = nodePos.x;
        nodePos.fy = nodePos.y;
      } else {
        nodePos.x = nodePos.fx ?? nodePos.x;
        nodePos.y = nodePos.fy ?? nodePos.y;
        delete nodePos.fx;
        delete nodePos.fy;
      }
    }
  }

  isNodeFixed(id) {
    const { layouts, nodes } = this.getParameters();
    return (
      layouts[id]?.fixed ??
      (this.options.fixBoundaries && nodes.value[id].zxType === "boundary")
    );
  }

  findBestNodePositions(
    nodeIds,
    forceGrid,
    allowOffPage,
    otherLayouts,
    otherNodes
  ) {
    let { layouts, nodes, configs, scale, svgPanZoom } = this.getParameters();
    layouts = otherLayouts ?? layouts;
    nodes = otherNodes ?? nodes.value;
    const area = svgPanZoom.getViewArea();
    const s = scale.value;
    const dist = this.options.grid;
    const forceDist = forceGrid ? dist : undefined;
    const withNoInitPos = [];
    for (const nodeId of nodeIds) {
      if (!layouts[nodeId]?.x || !layouts[nodeId]?.y) {
        withNoInitPos.push(nodeId);
        continue;
      }
      const node = nodes[nodeId];
      const nodeSize = getNodeSize(node, configs.node, s);
      const start = this.snapPosition(layouts[nodeId], forceDist);
      if (!allowOffPage) {
        if (start.x - nodeSize.width / 2 < area.box.left) {
          start.x = area.box.left + nodeSize.width / 2;
          this.snapPosition(start, forceDist);
          start.x += dist;
        } else if (start.x + nodeSize.width / 2 > area.box.right) {
          start.x = area.box.right - nodeSize.width / 2;
          this.snapPosition(start, forceDist);
          start.x -= dist;
        }
        if (start.y - nodeSize.height / 2 < area.box.top) {
          start.y = area.box.top + nodeSize.height / 2;
          this.snapPosition(start, forceDist);
          start.y += dist;
        } else if (start.y + nodeSize.height / 2 > area.box.bottom) {
          start.y = area.box.bottom - nodeSize.height / 2;
          this.snapPosition(start, forceDist);
          start.y -= dist;
        }
      }
      const candidate = { ...start };
      findPos: for (;;) {
        let collision = false;
        collide: for (const [id, pos] of Object.entries(layouts)) {
          if (nodeId === id) continue;
          const targetNode = nodes[id];
          if (!targetNode) continue;
          if (
            Math.abs(pos.x - candidate.x) < dist &&
            Math.abs(pos.y - candidate.y) < dist
          ) {
            collision = true;
            break collide;
          }
        }
        if (collision) {
          candidate.x += dist;
          if (!allowOffPage) {
            if (candidate.x + nodeSize.width / 2 > area.box.right) {
              candidate.x = start.x;
              candidate.y += dist;
            }
          }
        } else {
          break findPos;
        }
      }
      const pos = this.getOrCreateNodePosition(layouts, nodeId);
      this.setNodePosition(pos, candidate);
    }
    this.setNewNodePositions(withNoInitPos, layouts, nodes);
  }

  setNewNodePositions(nodeIds, otherLayouts, otherNodes) {
    let { layouts, nodes, configs, scale, svgPanZoom } = this.getParameters();
    layouts = otherLayouts ?? layouts;
    nodes = otherNodes ?? nodes.value;
    // Set the positions of newly added nodes
    const area = svgPanZoom.getViewArea();
    const s = scale.value;
    const dist = this.options.newNodePositionMargin || this.options.distance;
    for (const nodeId of nodeIds) {
      if (
        layouts[nodeId]?.x !== undefined &&
        layouts[nodeId]?.y !== undefined
      ) {
        continue;
      }
      // New node
      const node = nodes[nodeId];
      const nodeSize = getNodeSize(node, configs.node, s);
      const candidate = this.snapPosition({ ...area.center }, dist);
      findPos: for (;;) {
        let collision = false;
        collide: for (const [id, pos] of Object.entries(layouts)) {
          if (nodeId === id) continue;
          const targetNode = nodes[id];
          if (!targetNode) continue;
          const targetNodeSize = getNodeSize(targetNode, configs.node, s);
          if (areNodesCollision(candidate, nodeSize, pos, targetNodeSize)) {
            collision = true;
            break collide;
          }
        }
        if (collision) {
          candidate.x += dist;
          this.snapPosition(candidate, dist);
          if (candidate.x + nodeSize.width / 2 > area.box.right) {
            candidate.x = area.center.x;
            candidate.y += dist;
            this.snapPosition(candidate, dist);
          }
        } else {
          break findPos;
        }
      }
      const pos = this.getOrCreateNodePosition(layouts, nodeId);
      this.setNodePosition(pos, candidate);
    }
  }

  deactivate() {
    let emitter;
    if (this.getParameters) {
      emitter = this.getParameters().emitter;
    }
    if (this.simulation) {
      this.simulation.stop();
      delete this.simulation;
    }
    if (this.stopNetworkWatch) {
      this.stopNetworkWatch();
      delete this.stopNetworkWatch;
    }
    if (emitter && this.onDragCallback) {
      emitter.off("node:dragstart", this.onDragCallback);
      emitter.off("node:pointermove", this.onDragCallback);
      delete this.onDragCallback;
    }
    if (emitter && this.onDragEndCallback) {
      emitter.off("node:dragend", this.onDragEndCallback);
      delete this.onDragEndCallback;
    }
    if (emitter && this.onClickCallback) {
      emitter.off("node:click", this.onClickCallback);
      delete this.onClickCallback;
    }
    delete this.getParameters;
  }

  setNodePosition(nodeLayout, pos) {
    nodeLayout.value.x = Math.floor(pos.x + 0.0005, 3);
    nodeLayout.value.y = Math.floor(pos.y + 0.0005, 3);
  }

  getOrCreateNodePosition(layouts, node) {
    if (!layouts[node]) {
      layouts[node] = { x: 0, y: 0 };
    }
    return toRef(layouts, node);
  }

  snapPosition(coord, forceGrid) {
    if (forceGrid || this.options.snapToGrid) {
      const grid = forceGrid || this.options.grid;
      coord.x = Math.floor(coord.x / grid + 0.5) * grid;
      coord.y = Math.floor(coord.y / grid + 0.5) * grid;
    }
    return coord;
  }

  // Force layout methods
  createSimulation(nodes, edges) {
    const { layouts } = this.getParameters();
    const forceLink = d3.forceLink(edges).id((d) => d.id);
    const sim = d3
      .forceSimulation(nodes)
      .force("edge", forceLink.distance(this.options.distance).strength(2))
      .force("charge", d3.forceManyBody())
      .force(
        "collide",
        d3.forceCollide(this.options.distance / 2).strength(0.2)
      )
      //.force("center", d3.forceCenter().strength(0.01))
      .alphaMin(0.01)
      .alphaDecay(0.01);
    sim.on("tick", () => {
      for (const node of this.nodeLayouts) {
        const layout = layouts?.[node.id];
        if (layout) {
          layout.x = node.x ?? 0;
          layout.y = node.y ?? 0;
          layout.fixed = node.fixed;
        }
      }
    });
    return sim;
  }

  restartSimulation() {
    if (this.options.forceLayout) {
      this.simulation.alpha(0.1).restart();
    }
  }

  buildNodeLayouts() {
    const { layouts, nodes } = this.getParameters();
    this.setNewNodePositions(Object.keys(nodes.value));

    this.nodeLayouts = this.forceNodeLayouts(layouts);
    this.nodeLayoutMap = Object.fromEntries(
      this.nodeLayouts.map((n) => [n.id, n])
    );
  }

  networkChanged() {
    if (!this.getParameters) return;
    const { edges } = this.getParameters();
    this.buildNodeLayouts();
    this.simulation.nodes(this.nodeLayouts);
    const forceEdges = this.simulation.force("edge");
    if (forceEdges) {
      forceEdges.links(this.forceLayoutEdges(edges.value));
    }
    this.restartSimulation();
  }

  forceLayoutChanged() {
    if (this.options.forceLayout) {
      this.networkChanged();
      this.restartSimulation();
    } else {
      this.simulation.stop();
    }
  }

  forceNodeLayouts(layouts) {
    return Object.entries(layouts).map(([id, v]) => {
      return this.isNodeFixed(id)
        ? { id, ...v, fx: v.x, fy: v.y }
        : { id, ...v };
    });
  }

  forceLayoutEdges(edges) {
    // d3-force replaces the source/target in the edge with NodeDatum
    // objects, so build own link objects.
    return Object.values(edges)
      .filter((v) => v.source)
      .map((v) => ({
        source: v.source,
        target: v.target,
      }));
  }
}

const easeOut = (time, duration, start, end) => {
  start = start ?? end ?? undefined;
  end = end ?? start;
  if (start === end) {
    return start;
  }
  if (!(time < duration) || duration <= 0) {
    return end;
  }
  if (time < 0) {
    return start;
  }
  const change = end - start;
  let temp = time / duration - 1;
  return start + change * (temp * temp * temp + 1);
};

const overwriteDict = (oldObj, newObj) => {
  const oldKeys = Object.keys(oldObj);
  Object.assign(oldObj, newObj);
  for (const k of oldKeys) {
    if (!(k in newObj)) {
      delete oldObj[k];
    }
  }
};

// From https://github.com/dash14/v-network-graph/blob/main/src/utils/visual.ts
const getNodeSize = (node, style, scale) => {
  const shape = Config.values(style.normal, node);
  if (shape.type == "circle") {
    return {
      width: shape.radius * 2 * scale,
      height: shape.radius * 2 * scale,
    };
  } else {
    return {
      width: shape.width * scale,
      height: shape.height * scale,
    };
  }
};

// From https://github.com/dash14/v-network-graph/blob/main/src/utils/visual.ts
const areNodesCollision = (
  nodePos,
  nodeSize,
  targetNodePos,
  targetNodeSize
) => {
  const distanceX = Math.abs(nodePos.x - targetNodePos.x);
  const collisionX = distanceX < nodeSize.width / 2 + targetNodeSize.width / 2;

  const distanceY = Math.abs(nodePos.y - targetNodePos.y);
  const collisionY =
    distanceY < nodeSize.height / 2 + targetNodeSize.height / 2;
  return collisionX && collisionY;
};
