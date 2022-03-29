// Custom layout with optional force and grid
// Modified from v-network-graph ForceLayout
// https://github.com/dash14/v-network-graph/blob/0862692061da4a5d2ab212210e9f5f067621e4fb/src/layouts/force.ts

import { toRef, watch } from "vue";
import { Config } from "v-network-graph";
import * as d3 from "d3-force";

const DEFAULT_OPTIONS = {
  snapToGrid: false,
  grid: 10,
  distance: 50,
  forceLayout: false,
  fixBoundaries: true,
  newNodePositionMargin: 0, // Defaults to "distance"
};

export class ConfigurableLayout {
  constructor(options) {
    this.options = options;
    for (const [k, v] of Object.entries(DEFAULT_OPTIONS)) {
      if (this.options[k] === undefined) {
        this.options[k] = v;
      }
    }
  }

  onDeactivate() {}

  activate(parameters) {
    const { layouts, nodes, configs, emitter, scale, svgPanZoom } = parameters;

    const onDrag = (positions) => {
      for (const [id, pos] of Object.entries(positions)) {
        const layout = this.getOrCreateNodePosition(layouts, id);
        // TODO?
        // Decide if this node is fixed in force layout
        if (this.options.fixBoundaries) {
          //////Object.assign(layout.value, {fixed: layout.value.fixed || nodes.value[id].zxType === "boundary");
        }
        this.snapPosition(pos);
        this.setNodePosition(layout, pos);
      }
    };

    const setNewNodePositions = (nodeIds) => {
      // Set the positions of newly added nodes
      const area = svgPanZoom.getViewArea();
      const s = scale.value;
      for (const nodeId of nodeIds) {
        if (nodeId in layouts) continue;
        // New node
        const node = nodes.value[nodeId];
        const nodeSize = getNodeSize(node, configs.node, s);
        const candidate = this.snapPosition({ ...area.center });
        find_pos: for (;;) {
          let collision = false;
          collide: for (const [id, pos] of Object.entries(layouts)) {
            if (nodeId === id) continue;
            const targetNode = nodes.value[id];
            if (!targetNode) continue;
            const targetNodeSize = getNodeSize(targetNode, configs.node, s);
            if (areNodesCollision(candidate, nodeSize, pos, targetNodeSize)) {
              collision = true;
              break collide;
            }
          }
          if (collision) {
            candidate.x += this.options.distance;
            this.snapPosition(candidate);
            if (candidate.x + nodeSize.width / 2 > area.box.right) {
              candidate.x = area.center.x;
              candidate.y += this.options.DEFAULT_OPTIONS;
              this.snapPosition(candidate);
            }
          } else {
            break find_pos;
          }
        }
        const layout = this.getOrCreateNodePosition(layouts, nodeId);
        this.setNodePosition(layout, candidate);
      }
    };

    setNewNodePositions(Object.keys(nodes.value));
    const stopNodeWatch = watch(
      () => Object.keys(nodes.value),
      setNewNodePositions
    );

    emitter.on("node:dragstart", onDrag);
    emitter.on("node:pointermove", onDrag);
    emitter.on("node:dragend", onDrag);

    this.onDeactivate = () => {
      stopNodeWatch();
      emitter.off("node:dragstart", onDrag);
      emitter.off("node:pointermove", onDrag);
      emitter.off("node:dragend", onDrag);
    };
  }

  deactivate() {
    if (this.onDeactivate) {
      this.onDeactivate();
    }
  }

  setNodePosition(nodeLayout, pos) {
    nodeLayout.value.x = Math.floor(pos.x + 0.0005, 3);
    nodeLayout.value.y = Math.floor(pos.y + 0.0005, 3);
  }

  getOrCreateNodePosition(layouts, node) {
    const layout = toRef(layouts, node);
    if (!layouts.value) {
      layout.value = { x: 0, y: 0 };
    }
    return layout;
  }

  snapPosition(coord) {
    if (this.options.snapToGrid) {
      coord.x =
        Math.floor(coord.x / this.options.grid + 0.5) * this.options.grid;
      coord.y =
        Math.floor(coord.y / this.options.grid + 0.5) * this.options.grid;
    }
    return coord;
  }
}

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
