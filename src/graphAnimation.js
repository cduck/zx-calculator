export function AssertionError(msg) {
  this.message = msg;
}
export const assert = (condition, msg) => {
  if (!condition) {
    throw new AssertionError(msg);
  }
};

export class AnimationState {
  constructor(
    graph,
    nodesInfo,
    edgesInfo,
    anglesInfo,
    selectedNodes,
    selectedEdges
  ) {
    this.graph = graph;
    this.nodesInfo = nodesInfo;
    this.edgesInfo = edgesInfo;
    this.anglesInfo = anglesInfo;
    this.selectedNodes = selectedNodes;
    this.selectedEdges = selectedEdges;
  }

  applyAnimationStart() {
    for (const [node, info] of Object.entries(this.nodesInfo.addedBefore)) {
      this.graph.nodes[node] = {
        ...this.graph.nodes[node],
        zxType: info.zxType,
        opacity: info.opacity,
      };
      if (this.nodesInfo.removedAfter[node]) {
        this.graph.nodes[node].animateOut = true;
      }
      this.graph.layouts.nodes[node] = {
        ...this.graph.layouts.nodes[node],
        x: info.x,
        y: info.y,
      };
    }
    for (const node of Object.keys(this.nodesInfo.removedAfter)) {
      this.graph.nodes[node] = {
        ...this.graph.nodes[node],
        animateOut: true,
      };
    }
    for (const [node, info] of Object.entries(this.nodesInfo.addedAfter)) {
      if (this.nodesInfo.removedAfter[node]) continue;
      this.graph.nodes[node] = {
        ...this.graph.nodes[node],
        zxType: info.zxType,
        opacity: 0,
      };
      this.graph.layouts.nodes[node] = {
        ...this.graph.layouts.nodes[node],
        x: info.x,
        y: info.y,
      };
    }
    for (const node of Object.keys(this.nodesInfo.removedBefore)) {
      delete this.graph.nodes[node];
      delete this.graph.layouts.nodes[node];
    }
    for (const [edge, info] of Object.entries(this.edgesInfo.addedBefore)) {
      this.graph.edges[edge] = {
        ...this.graph.edges[edge],
        source: info.source,
        target: info.target,
        zxType: info.zxType,
        opacity: info.opacity,
      };
    }
    for (const edge of Object.keys(this.edgesInfo.removedAfter)) {
      this.graph.edges[edge] = {
        ...this.graph.edges[edge],
        animateOut: true,
      };
    }
    for (const [edge, info] of Object.entries(this.edgesInfo.addedAfter)) {
      if (this.edgesInfo.removedAfter[edge]) continue;
      this.graph.edges[edge] = {
        ...this.graph.edges[edge],
        source: info.source,
        target: info.target,
        zxType: info.zxType,
        opacity: 0,
      };
    }
    for (const edge of Object.keys(this.edgesInfo.removedBefore)) {
      delete this.graph.edges[edge];
    }
    for (const [node, info] of Object.entries(this.anglesInfo.setAtStart)) {
      this.graph.nodes[node] = {
        ...(this.graph.nodes[node] ?? assert(false, "node doesn't exist")),
        zxAngle: info.angle,
        labelOpacity: info.labelOpacity * info.labelOpacity,
      };
    }
  }

  applyAnimationStep(progress) {
    const weightedAverage = (pair) => pair[0] + progress * (pair[1] - pair[0]);
    for (const [node, info] of Object.entries(this.nodesInfo.animated)) {
      this.graph.nodes[node] = {
        ...(this.graph.nodes[node] ?? assert(false, "node doesn't exist")),
        opacity: weightedAverage(info.opacity),
      };
      this.graph.layouts.nodes[node] = {
        ...(this.graph.layouts.nodes[node] ??
          assert(false, "node doesn't exist")),
        x: weightedAverage(info.x),
        y: weightedAverage(info.y),
      };
    }
    for (const [edge, info] of Object.entries(this.edgesInfo.animated)) {
      this.graph.edges[edge] = {
        ...(this.graph.edges[edge] ?? assert(false, "edge doesn't exist")),
        opacity: weightedAverage(info.opacity),
      };
    }
    // Fade old angle out then new angle in
    for (const [node, info] of Object.entries(this.anglesInfo.animated)) {
      let angle, opacity;
      if (!info.angle[0]) {
        angle = info.angle[1];
        opacity = progress;
      } else if (!info.angle[1]) {
        angle = info.angle[0];
        opacity = 1 - progress;
      } else if (progress < 0.5) {
        angle = info.angle[0];
        opacity = 1 - 2 * progress;
      } else {
        angle = info.angle[1];
        opacity = 2 * progress - 1;
      }
      this.graph.nodes[node] = {
        ...(this.graph.nodes[node] ?? assert(false, "node doesn't exist")),
        zxAngle: angle,
        labelOpacity: opacity * opacity,
      };
    }
  }

  applyAnimationEnd() {
    for (const [node, info] of Object.entries(this.anglesInfo.setAtEnd)) {
      this.graph.nodes[node] = {
        ...this.graph.nodes[node],
        zxAngle: info.angle,
      };
    }
    for (const node of Object.keys(this.nodesInfo.addedAfter)) {
      delete this.graph.nodes[node]?.opacity;
    }
    for (const node of Object.keys(this.nodesInfo.removedAfter)) {
      delete this.graph.nodes[node];
      delete this.graph.layouts.nodes[node];
    }
    for (const edge of Object.keys(this.edgesInfo.addedAfter)) {
      delete this.graph.edges[edge]?.opacity;
    }
    for (const edge of Object.keys(this.edgesInfo.removedAfter)) {
      delete this.graph.edges[edge];
    }
  }
}

export class AnimationSpec {
  constructor() {
    // Map (node or edge) =>
    // { into: "start"|"fade", out: "end"|"fade"|"start" }
    this.changingEdges = {};
    // Map node =>
    // { oldX, oldY, newX, newY,
    //  into: "start"|"fade", out: "end"|"fade"|"start" }
    this.changingNodes = {};
    // Map node => { oldAngle, newAngle, fade: true|false }
    this.changingAngles = {};
    // Arrays of ids
    this.selectedNodes = [];
    this.selectedEdges = [];
  }

  ////////// Animation queries //////////
  needsAnimation() {
    for (const { into, out } of Object.values(this.changingEdges)) {
      if (into === "fade" || out === "fade") return true;
    }
    for (const s of Object.values(this.changingNodes)) {
      if (s.into === "fade" || s.out === "fade") return true;
      if (s.oldX !== s.newX || s.oldY !== s.newY) return true;
    }
    for (const info of Object.values(this.changingAngles)) {
      if (info.fade && info.oldAngle !== info.newAngle) return true;
    }
    return false;
  }

  getAnimationState(graph) {
    return new AnimationState(
      graph,
      this.animatedNodesInfo(),
      this.animatedEdgesInfo(),
      this.animatedAnglesInfo(),
      this.selectedNodes,
      this.selectedEdges
    );
  }

  animatedNodesInfo() {
    const addedBefore = {};
    const removedBefore = {};
    const addedAfter = {};
    const removedAfter = {};
    const animated = {};
    for (const [node, info] of Object.entries(this.changingNodes)) {
      const oldOpacity = info.into === "fade" && info.out !== "fade" ? 0 : 1;
      const newOpacity = info.out === "fade" ? 0 : 1;
      if (info.into) {
        if (info.into === "end") {
          addedAfter[node] = {
            zxType: info.zxType,
            x: info.newX,
            y: info.newY,
          };
        } else {
          addedBefore[node] = {
            zxType: info.zxType,
            x: info.oldX,
            y: info.oldY,
            opacity: oldOpacity,
          };
        }
      }
      if (info.out) {
        if (info.out === "start") removedBefore[node] = {};
        else removedAfter[node] = {};
      }
      if (
        info.into === "fade" ||
        info.out === "fade" ||
        info.oldX !== info.newX ||
        info.oldY !== info.newY
      ) {
        animated[node] = {
          x: [info.oldX, info.newX],
          y: [info.oldY, info.newY],
          opacity: [oldOpacity, newOpacity],
        };
      }
    }
    return { addedBefore, removedBefore, addedAfter, removedAfter, animated };
  }
  animatedEdgesInfo() {
    const all = {};
    const addedBefore = {};
    const removedBefore = {};
    const addedAfter = {};
    const removedAfter = {};
    const animated = {};
    for (const [edge, info] of Object.entries(this.changingEdges)) {
      all[edge] = info;
      if (info.into) {
        if (info.into === "end") {
          addedAfter[edge] = {
            source: info.source,
            target: info.target,
            zxType: info.zxType,
          };
        } else {
          addedBefore[edge] = {
            source: info.source,
            target: info.target,
            zxType: info.zxType,
            opacity: info.into === "fade" && info.out !== "fade" ? 0 : 1,
          };
        }
      }
      if (info.out) {
        if (info.out === "start") removedBefore[edge] = {};
        else removedAfter[edge] = {};
      }
      if (info.out === "fade") {
        animated[edge] = { opacity: [1, 0] };
      } else if (info.into === "fade") {
        animated[edge] = { opacity: [0, 1] };
      }
    }
    return { addedBefore, removedBefore, addedAfter, removedAfter, animated };
  }
  animatedAnglesInfo() {
    const setAtStart = {};
    const setAtEnd = {};
    const animated = {};
    for (const [node, info] of Object.entries(this.changingAngles)) {
      setAtStart[node] = { angle: info.oldAngle };
      setAtEnd[node] = { angle: info.newAngle };
      if (info.fade && info.oldAngle !== info.newAngle) {
        animated[node] = { angle: [info.oldAngle, info.newAngle] };
        if (!info.oldAngle) {
          setAtStart[node].labelOpacity = 0;
        }
      }
    }
    return { setAtStart, setAtEnd, animated };
  }

  ////////// Log graph changes with animation hints //////////
  addEdge(edge, source, target, zxType, addInstant, noFade) {
    if (!this.changingEdges[edge]) {
      this.changingEdges[edge] = {
        source,
        target,
        zxType,
        into: addInstant ? "start" : noFade ? "end" : "fade",
      };
    }
  }

  setEdgeType(edge, zxType) {
    if (this.changingEdges[edge]?.into) {
      this.changingEdges[edge].zxType = zxType;
    } else {
      this.changingEdges[edge] = {
        zxType,
      };
    }
  }

  removeEdge(edge, noFade, removeInstant) {
    const out = removeInstant ? "start" : noFade ? "end" : "fade";
    if (this.changingEdges[edge]) {
      this.changingEdges[edge].out = out;
    } else {
      this.changingEdges[edge] = { out };
    }
  }

  addNode(node, zxType, oldX, oldY, newX, newY, addInstant, noFade) {
    if (!this.changingNodes[node]) {
      this.changingNodes[node] = {
        zxType,
        oldX: oldX ?? newX ?? undefined,
        oldY: oldY ?? newY ?? undefined,
        newX: newX ?? oldX ?? undefined,
        newY: newY ?? oldY ?? undefined,
        into: addInstant ? "start" : noFade ? "end" : "fade",
      };
    }
  }

  moveNode(node, oldX, oldY, newX, newY) {
    if (this.changingNodes[node]) {
      this.changingNodes[node].newX = newX ?? oldX ?? undefined;
      this.changingNodes[node].newY = newY ?? oldY ?? undefined;
    } else {
      this.changingNodes[node] = {
        oldX: oldX ?? newX ?? undefined,
        oldY: oldY ?? newY ?? undefined,
        newX: newX ?? oldX ?? undefined,
        newY: newY ?? oldY ?? undefined,
      };
    }
  }

  removeNode(node, oldX, oldY, newX, newY, noFade, removeInstant) {
    const out = removeInstant ? "start" : noFade ? "end" : "fade";
    if (this.changingNodes[node]) {
      this.changingNodes[node].out = this.changingNodes[node].out ?? out;
      this.changingNodes[node].newX = newX ?? oldX ?? undefined;
      this.changingNodes[node].newY = newY ?? oldY ?? undefined;
    } else {
      this.changingNodes[node] = {
        oldX: oldX ?? newX ?? undefined,
        oldY: oldY ?? newY ?? undefined,
        newX: newX ?? oldX ?? undefined,
        newY: newY ?? oldY ?? undefined,
        out: !!noFade || "fade",
      };
    }
  }

  setAngle(node, oldAngle, newAngle, setInstant, setAtEnd) {
    if (this.changingAngles[node]) {
      this.changingAngles[node].newAngle = newAngle;
      this.changingAngles[node].fade =
        this.changingAngles[node].fade || !setAtEnd;
    } else {
      this.changingAngles[node] = {
        oldAngle: setInstant && !setAtEnd ? newAngle : oldAngle,
        newAngle,
        fade: !setInstant && !setAtEnd,
      };
    }
  }
}
