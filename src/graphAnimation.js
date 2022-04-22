export class AnimationState {
  constructor(graph, nodesInfo, edgesInfo, anglesInfo) {
    this.graph = graph;
    this.nodesInfo = nodesInfo;
    this.edgesInfo = edgesInfo;
    this.anglesInfo = anglesInfo;
  }

  applyAnimationStart() {
    for (const [node, info] of Object.entries(this.nodesInfo.addedBefore)) {
      console.log("new node", node, info);
      this.graph.nodes[node] = {
        ...(this.graph.nodes[node] ?? {}),
        zxType: info.zxType,
        opacity: info.opacity,
      };
      this.graph.layouts.nodes[node] = {
        ...(this.graph.layouts.nodes[node] ?? {}),
        x: info.x,
        y: info.y,
      };
      console.log(this.graph.nodes[node], this.graph.layouts.nodes[node]);
    }
    for (const node of Object.keys(this.nodesInfo.removedBefore)) {
      delete this.graph.nodes[node];
      delete this.graph.layouts.nodes[node];
    }
    for (const [edge, info] of Object.entries(this.edgesInfo.addedBefore)) {
      this.graph.edges[edge] = {
        ...(this.graph.edges[edge] ?? {}),
        source: info.source,
        target: info.target,
        zxType: info.zxType,
        opacity: info.opacity,
      };
    }
    for (const edge of Object.keys(this.edgesInfo.removedBefore)) {
      delete this.graph.edges[edge];
    }
    for (const [node, info] of Object.entries(this.anglesInfo.setAtStart)) {
      this.graph.nodes[node] = {
        ...(this.graph.nodes[node] ?? {}),
        zxAngle: info.angle,
      };
    }
  }

  applyAnimationStep(progress) {
    const weightedAverage = (pair) => pair[0] + progress * (pair[1] - pair[0]);
    for (const [node, info] of Object.entries(this.nodesInfo.animated)) {
      this.graph.nodes[node] = {
        ...this.graph.nodes[node],
        opacity: weightedAverage(info.opacity),
      };
      this.graph.layouts.nodes[node] = {
        ...this.graph.layouts.nodes[node],
        x: weightedAverage(info.x),
        y: weightedAverage(info.y),
      };
    }
    for (const [edge, info] of Object.entries(this.edgesInfo.animated)) {
      this.graph.edges[edge] = {
        ...this.graph.edges[edge],
        opacity: weightedAverage(info.opacity),
      };
    }
    // TODO: Fade angle
  }

  applyAnimationEnd() {
    for (const [node, info] of Object.entries(this.anglesInfo.setAtEnd)) {
      this.graph.nodes[node] = {
        ...(this.graph.nodes[node] ?? {}),
        zxAngle: info.angle,
      };
    }
    for (const node of Object.keys(this.nodesInfo.removedAfter)) {
      delete this.graph.nodes[node];
      delete this.graph.layouts.nodes[node];
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
    // Cannot currently fade angles
    //for (const { fade } of Object.values(this.changingAngles)) {
    //  if (fade) return true;
    //}
    return false;
  }

  getAnimationState(graph) {
    return new AnimationState(
      graph,
      this.animatedNodesInfo(),
      this.animatedEdgesInfo(),
      this.animatedAnglesInfo()
    );
  }

  animatedNodesInfo() {
    const addedBefore = {};
    const removedBefore = {};
    const removedAfter = {};
    const animated = {};
    for (const [node, info] of Object.entries(this.changingNodes)) {
      const oldOpacity = info.into === "fade" && info.out !== "fade" ? 0 : 1;
      const newOpacity = info.out === "fade" ? 0 : 1;
      if (info.into) {
        addedBefore[node] = {
          zxType: info.zxType,
          x: info.oldX,
          y: info.oldY,
          opacity: oldOpacity,
        };
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
    return { addedBefore, removedBefore, removedAfter, animated };
  }
  animatedEdgesInfo() {
    const all = {};
    const addedBefore = {};
    const removedBefore = {};
    const removedAfter = {};
    const animated = {};
    for (const [edge, info] of Object.entries(this.changingEdges)) {
      all[edge] = info;
      if (info.into) {
        addedBefore[edge] = {
          source: info.source,
          target: info.target,
          zxType: info.zxType,
          opacity: info.into === "fade" && info.out !== "fade" ? 0 : 1,
        };
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
    return { addedBefore, removedBefore, removedAfter, animated };
  }
  animatedAnglesInfo() {
    const setAtStart = {};
    const setAtEnd = {};
    const animated = {};
    for (const [node, info] of Object.entries(this.changingNodes)) {
      setAtStart[node] = { angle: info.oldAngle };
      setAtEnd[node] = { angle: info.newAngle };
      if (info.fade && info.oldAngle !== info.newAngle) {
        animated[node] = { angle: [info.oldAngle, info.newAngle] };
      }
    }
    return { setAtStart, setAtEnd, animated };
  }

  nodeLocationStartEnd(node) {
    return [
      {
        x: this.changingNodes[node]?.oldX,
        y: this.changingNodes[node]?.oldY,
      },
      {
        x: this.changingNodes[node]?.newX,
        y: this.changingNodes[node]?.newY,
      },
    ];
  }
  nodeOpacityStartEnd(node) {
    if (this.changingNodes[node]?.out === "fade") {
      return [1, 0];
    } else if (this.changingNodes[node]?.into === "fade") {
      return [0, 1];
    } else {
      return [1, 1];
    }
  }
  edgeOpacityStartEnd(edge) {
    if (this.changingEdges[edge]?.out === "fade") {
      return [1, 0];
    } else if (this.changingEdges[edge]?.into === "fade") {
      return [0, 1];
    } else {
      return [1, 1];
    }
  }
  angleFadeStartEnd(node) {
    if (this.changingAngles[node].fade) {
      return [
        this.changingAngles[node].oldAngle,
        this.changingAngles[node].newAngle,
      ];
    } else {
      return [
        this.changingAngles[node].oldAngle,
        this.changingAngles[node].oldAngle,
      ];
    }
  }
  angleToSetAfter(node) {
    return this.changingAngles[node].newAngle;
  }

  ////////// Log graph changes with animation hints //////////
  addEdge(edge, source, target, zxType, addInstant) {
    if (!this.changingEdges[edge]) {
      this.changingEdges[edge] = {
        source,
        target,
        zxType,
        into: addInstant ? "start" : "fade",
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

  addNode(node, zxType, oldX, oldY, newX, newY, addInstant) {
    if (!this.changingNodes[node]) {
      this.changingNodes[node] = {
        zxType,
        oldX: oldX ?? newX ?? undefined,
        oldY: oldY ?? newY ?? undefined,
        newX: newX ?? oldX ?? undefined,
        newY: newY ?? oldY ?? undefined,
        into: addInstant ? "start" : "fade",
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
        oldAngle: setInstant ? newAngle : oldAngle,
        newAngle,
        fade: !setInstant && !setAtEnd,
      };
    }
  }
}
