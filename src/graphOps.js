import {
  angleStrSum,
  angleStrDiff,
  isZero,
  isPi,
  isPiDiv2,
  isPiDivN2,
  ANGLE_PI,
} from "@/angles.js";

// Graph exceptions
export function GraphOperationException(msg) {
  this.message = msg;
}

export function AssertionError(msg) {
  this.message = msg;
}
export const assert = (condition, msg) => {
  if (!condition) {
    throw new AssertionError(msg);
  }
};

const TOGGLE_EDGE_MAP = {
  "hadamard": "normal",
  "normal": "hadamard",
};
const TOGGLE_NODE_MAP = {
  "z": "x",
  "x": "z",
};

export class GraphOps {
  constructor(graph, findBestNodePositions) {
    this.graph = graph ?? {
      nodes: {},
      edges: {},
      paths: {},
      layouts: { nodes: {} },
    };
    this.findBestNodePositions = findBestNodePositions;

    this.nextNodeIndex = Object.keys(this.graph.nodes).length + 1;
    this.nextEdgeIndex = Object.keys(this.graph.edges).length + 1;
    this.nextPathIndex = Object.keys(this.graph.paths).length + 1;
  }

  ////////// Graph tests //////////
  isBoundaryNode(nodeId) {
    return this.graph.nodes[nodeId]?.zxType === "boundary";
  }
  isZNode(nodeId) {
    return this.graph.nodes[nodeId]?.zxType === "z";
  }
  isXNode(nodeId) {
    return this.graph.nodes[nodeId]?.zxType === "x";
  }
  isZOrXNode(nodeId) {
    const t = this.graph.nodes[nodeId]?.zxType;
    return t === "z" || t === "x";
  }
  nodeType(nodeId) {
    return this.graph.nodes[nodeId]?.zxType;
  }
  setNodeType(nodeId, zxType) {
    this.graph.nodes[nodeId] = { ...this.graph.nodes[nodeId], zxType: zxType };
  }
  isNormalEdge(edgeId) {
    return this.graph.edges[edgeId]?.zxType === "normal";
  }
  isHadamardEdge(edgeId) {
    return this.graph.edges[edgeId]?.zxType === "hadamard";
  }
  edgeType(edgeId) {
    return this.graph.edges[edgeId]?.zxType;
  }
  setEdgeType(edgeId, zxType) {
    this.graph.edges[edgeId] = { ...this.graph.edges[edgeId], zxType: zxType };
  }

  isEdgesValidPath(edgeIds, ignoreCurrent) {
    const orderedEdges = this._isEdgesValidPathHelper(edgeIds, ignoreCurrent);
    return typeof orderedEdges !== "string";
  }
  sortValidPathEdges(edgeIds, ignoreCurrent) {
    const orderedEdges = this._isEdgesValidPathHelper(edgeIds, ignoreCurrent);
    if (typeof orderedEdges === "string") {
      throw new GraphOperationException(orderedEdges);
    }
    return orderedEdges;
  }
  isEdgesValidPathReason(edgeIds, ignoreCurrent) {
    const orderedEdges = this._isEdgesValidPathHelper(edgeIds, ignoreCurrent);
    if (typeof orderedEdges === "string") {
      return orderedEdges;
    } else {
      return "valid path";
    }
  }
  _isEdgesValidPathHelper(edgeIds, ignoreCurrent) {
    if (edgeIds.length < 1) {
      return "empty path";
    }
    if (edgeIds.find((e) => !this.graph.edges[e])) {
      return "nonexistant edge";
    }

    if (!ignoreCurrent) {
      let overlap = false;
      this.forPathsConflictingWithEdges(edgeIds, () => {
        overlap = true;
      });
      if (overlap) {
        return "path overlaps with current edge or node of another path";
      }
    }

    const counts = {};
    const orderedNodes = [];
    const neighbors = {};
    const nodePairToEid = {};
    // Count nodes used by edges to determine path properties
    for (const eid of edgeIds) {
      const [n1, n2] = this.nodesOfEdge(eid);
      assert(n1 !== n2, "graph self loop");
      nodePairToEid[this.nodePairString(n1, n2)] = eid;
      if (!counts[n1]) orderedNodes.push(n1);
      if (!counts[n2]) orderedNodes.push(n2);
      counts[n1] = (counts[n1] || 0) + 1;
      counts[n2] = (counts[n2] || 0) + 1;
      if (!neighbors[n1]) neighbors[n1] = new Set();
      if (!neighbors[n2]) neighbors[n2] = new Set();
      neighbors[n1].add(n2);
      neighbors[n2].add(n1);
    }
    const endNodes = [];
    for (const nid of orderedNodes) {
      if (counts[nid] > 2) {
        return "path overlaps with itself or has loops";
      } else if (counts[nid] == 1) {
        // Save this end node as the first or last
        if (!this.isBoundaryNode(nid)) {
          return "path ends must be boundary nodes";
        }
        endNodes.push(nid);
      } else {
        // counts[nid] == 2
        if (this.isBoundaryNode(nid)) {
          return "path body must not be boundary nodes";
        }
      }
    }
    if (endNodes.length != 2) {
      // Path is disconnected or a loop
      return "path is disconnected or a loop";
    }
    // Get the final edge order
    const [first, last] = endNodes;
    const finalEdges = [];
    let prev = null;
    let current = first;
    // Modifies neighbors in-place
    while (current != last) {
      const nextSet = neighbors[current];
      nextSet.delete(prev);
      prev = current;
      assert(nextSet.size === 1, "Internal node count");
      // current = (only value in nextSet)
      for (current of nextSet) {
        // Empty
      }
      finalEdges.push(nodePairToEid[this.nodePairString(prev, current)]);
    }
    if (finalEdges.length != edgeIds.length) {
      return "path is a valid path but with one or more disconnected loops";
    }
    return finalEdges;
  }

  ////////// Graph queries //////////
  nodesOfEdge(edgeId) {
    return [this.graph.edges[edgeId].source, this.graph.edges[edgeId].target];
  }

  coordsOfNode(nodeId) {
    const coords = this.graph.layouts.nodes[nodeId];
    return [coords.x, coords.y];
  }

  degree(nodeId) {
    let deg = 0;
    this.forEdgesOfNodes([nodeId], () => {
      deg += 1;
    });
    return deg;
  }
  hDegree(nodeId) {
    let deg = 0;
    this.forEdgesOfNodes([nodeId], (edgeId) => {
      deg += this.isHadamardEdge(edgeId);
    });
    return deg;
  }

  angle(nodeId) {
    return this.graph.nodes[nodeId].zxAngle ?? "0";
  }
  hasAngleZero(nodeId) {
    return isZero(this.angle(nodeId));
  }
  hasAnglePi(nodeId) {
    return isPi(this.angle(nodeId));
  }
  hasAngleZeroOrPi(nodeId) {
    const a = this.angle(nodeId);
    return isZero(a) || isPi(a);
  }
  hasAnglePlusOrMinusPiDiv2(nodeId) {
    const a = this.angle(nodeId);
    return isPiDiv2(a) || isPiDivN2(a);
  }

  locationXY(nodeId) {
    return [this.locationX(nodeId), this.locationY(nodeId)];
  }
  locationX(nodeId) {
    return this.graph.layouts.nodes[nodeId]?.x;
  }
  locationY(nodeId) {
    return this.graph.layouts.nodes[nodeId]?.y;
  }
  setLocation(nodeId, x, y, forceLocation) {
    if (this.graph.layouts.nodes[nodeId]) {
      this.graph.layouts.nodes[nodeId] = {
        ...this.graph.layouts.nodes[nodeId],
        x: x,
        y: y,
      };
    } else {
      this.graph.layouts.nodes[nodeId] = { x: x, y: y };
    }
    if (this.findBestNodePositions && !forceLocation) {
      this.findBestNodePositions([nodeId]);
    }
  }

  isNodeNearBoundary(nodeId) {
    if (!this.isZOrXNode(nodeId)) {
      // Shortcut if this node is a boundary
      return true;
    }
    let near = false;
    this.forNodeCollectiveNeighborhood([nodeId], (n) => {
      if (!this.isZOrXNode(n)) {
        near = true;
      }
    });
    return near;
  }

  // Calls callback for every edge that uses at least one node
  forEdgesOfNodes(nodeIds, callback) {
    const nodeIdSet = nodeIds instanceof Set ? nodeIds : new Set(nodeIds);
    const edges = this.graph.edges;
    for (const edgeId of Object.keys(edges)) {
      if (
        nodeIdSet.has(edges[edgeId].source) ||
        nodeIdSet.has(edges[edgeId].target)
      ) {
        callback(edgeId);
      }
    }
  }

  // Calls callback for every edge that uses at least one node
  forEdgesOfNodesMutate(nodeIds, callback) {
    const nodeIdSet = nodeIds instanceof Set ? nodeIds : new Set(nodeIds);
    const edges = this.graph.edges;
    const matches = [];
    for (const edgeId of Object.keys(edges)) {
      if (
        nodeIdSet.has(edges[edgeId].source) ||
        nodeIdSet.has(edges[edgeId].target)
      ) {
        matches.push(edgeId);
      }
    }
    matches.forEach(callback);
  }

  // Calls callback for every edge that uses at least two nodes
  forInnerEdgesOfNodes(nodeIds, callback) {
    const nodeIdSet = nodeIds instanceof Set ? nodeIds : new Set(nodeIds);
    const edges = this.graph.edges;
    for (const edgeId of Object.keys(edges)) {
      if (
        nodeIdSet.has(edges[edgeId].source) &&
        nodeIdSet.has(edges[edgeId].target)
      ) {
        callback(edgeId);
      }
    }
  }

  // Calls callback for every edge that connects a node in A to one in B
  forCrossingEdgesOfNodes(nodeIdsA, nodeIdsB, callback) {
    const nodeIdSetA = nodeIdsA instanceof Set ? nodeIdsA : new Set(nodeIdsA);
    const nodeIdSetB = nodeIdsB instanceof Set ? nodeIdsB : new Set(nodeIdsB);
    const edges = this.graph.edges;
    for (const edgeId of Object.keys(edges)) {
      if (
        (nodeIdSetA.has(edges[edgeId].source) &&
          nodeIdSetB.has(edges[edgeId].target)) ||
        (nodeIdSetB.has(edges[edgeId].source) &&
          nodeIdSetA.has(edges[edgeId].target))
      ) {
        callback(edgeId);
      }
    }
  }

  pathEdges(pathId) {
    return this.graph.paths[pathId].edges;
  }

  // Calls callback for every path that uses at least one edge
  // But this does not include all paths conflicted with these edges
  forPathsOfEdges(edgeIds, callback) {
    const paths = this.graph.paths;
    for (const pathId of Object.keys(paths)) {
      const pathEdgeSet = new Set(paths[pathId].edges);
      inner: for (const edgeId of edgeIds) {
        if (pathEdgeSet.has(edgeId)) {
          callback(pathId);
          break inner;
        }
      }
    }
  }

  // Calls callback for every path that uses at least one edge or shared node
  forPathsConflictingWithEdges(edgeIds, callback) {
    const paths = this.graph.paths;
    for (const pathId of Object.keys(paths)) {
      const pathNodeSet = new Set();
      for (const edgeId of paths[pathId].edges) {
        const [n1, n2] = this.nodesOfEdge(edgeId);
        pathNodeSet.add(n1);
        pathNodeSet.add(n2);
      }
      inner: for (const edgeId of edgeIds) {
        const [n1, n2] = this.nodesOfEdge(edgeId);
        if (pathNodeSet.has(n1) || pathNodeSet.has(n2)) {
          callback(pathId);
          break inner;
        }
      }
    }
  }

  // Calls callback for every (sorted) pair of nodes
  forCompleteGraph(nodeIds, callback) {
    // Iterate over all node pairs from `nodes`
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        let n1 = nodeIds[i];
        let n2 = nodeIds[j];
        // Sort nodes to simplify edge checks
        if (n1 <= n2) {
          callback(n1, n2);
        } else {
          callback(n2, n1);
        }
      }
    }
  }

  // Calls callback for every neighbor other than those in nodeIds
  forNodeCollectiveNeighborhood(nodeIds, callback) {
    const nodeIdSet = nodeIds instanceof Set ? nodeIds : new Set(nodeIds);
    for (let eid of Object.keys(this.graph.edges)) {
      const [n1, n2] = this.nodesOfEdge(eid);
      if (nodeIdSet.has(n1) && !nodeIdSet.has(n2)) {
        callback(n2);
      } else if (nodeIdSet.has(n2) && !nodeIdSet.has(n1)) {
        callback(n1);
      }
    }
  }

  ////////// Graph subroutines //////////
  nodePairString(n1, n2) {
    if (n1 <= n2) {
      return `${n1}$${n2}`;
    } else {
      return `${n2}$${n1}`;
    }
  }

  ////////// Graph operations //////////
  addNode(zxType, x, y, angle, forceLocation) {
    assert(zxType, "required first argument");
    let nodeId = `node${this.nextNodeIndex}`;
    while (this.graph.nodes[nodeId]) {
      this.nextNodeIndex *= 2;
      nodeId = `node${this.nextNodeIndex}`;
    }
    this.nextNodeIndex += 1;
    this.graph.nodes[nodeId] = {
      zxType: zxType,
    };
    if (angle && !isZero(angle)) {
      this.graph.nodes[nodeId].zxAngle = angle;
    }
    if (x !== undefined && y !== undefined) {
      this.graph.layouts.nodes[nodeId] = { x: x, y: y };
    }
    if (this.findBestNodePositions && !forceLocation) {
      this.findBestNodePositions([nodeId]);
    }
    return nodeId;
  }
  addZNode(x, y, angle) {
    return this.addNode("z", x, y, angle);
  }
  addXNode(x, y, angle) {
    return this.addNode("x", x, y, angle);
  }
  addBoundaryNode(x, y, angle) {
    return this.addNode("boundary", x, y, angle);
  }

  addEdge(n1, n2, zxType) {
    assert(zxType, "required third argument");
    let edgeId = `edge${this.nextEdgeIndex}`;
    while (this.graph.edges[edgeId]) {
      this.nextEdgeIndex *= 2;
      edgeId = `edge${this.nextEdgeIndex}`;
    }
    this.nextEdgeIndex += 1;
    if (n2 > n1) {
      [n1, n2] = [n2, n1];
    }
    this.graph.edges[edgeId] = {
      source: n1,
      target: n2,
      zxType: zxType,
    };
    return edgeId;
  }
  addNormalEdge(n1, n2) {
    return this.addEdge(n1, n2, "normal");
  }
  addHadamardEdge(n1, n2) {
    return this.addEdge(n1, n2, "hadamard");
  }
  toggleHadamardEdgeHandleSelfLoop(n1, n2, dontToggle) {
    // Find existing Hadamard edges
    const edges = [];
    let hasNormalEdge = false;
    this.forInnerEdgesOfNodes([n1, n2], (edgeId) => {
      if (this.isHadamardEdge(edgeId)) {
        edges.push(edgeId);
      } else if (this.isNormalEdge(edgeId)) {
        hasNormalEdge = edgeId;
      }
    });
    if (
      (hasNormalEdge || n1 === n2) &&
      this.nodeType(n1) === this.nodeType(n2) &&
      this.isZOrXNode(n1)
    ) {
      this.deleteEdges(edges);
      if ((edges.length + !dontToggle) % 2 === 1) {
        // Self loop is equal to an extra pi phase
        this.addAngle(n1, ANGLE_PI);
      }
      return hasNormalEdge || undefined;
    } else {
      this.deleteEdges(edges.slice((edges.length + !dontToggle) % 2));
      if (edges.length <= 0 && !dontToggle) {
        return this.addHadamardEdge(n1, n2);
      } else if ((edges.length + !dontToggle) % 2 == 1) {
        return edges[0];
      }
    }
  }

  toggleEdgeColor(edgeId) {
    const zxType = this.edgeType(edgeId);
    const newType = TOGGLE_EDGE_MAP[zxType];
    if (newType && newType !== zxType) {
      this.graph.edges[edgeId] = {
        ...this.graph.edges[edgeId],
        zxType: newType,
      };
    }
  }

  toggleNodeColor(nodeId) {
    const zxType = this.nodeType(nodeId);
    const newType = TOGGLE_NODE_MAP[zxType];
    if (newType && newType !== zxType) {
      this.graph.nodes[nodeId] = {
        ...this.graph.nodes[nodeId],
        zxType: newType,
      };
    }
  }

  // If zxType is undefined, uses normal edges only to boundary nodes
  // If zxType, enforces this type for removed edges
  toggleEdges(nodeIds, zxType) {
    const allEdges = this.graph.edges;
    const oldEdgeIds = new Set();
    const oldNodePairs = new Set();
    this.forInnerEdgesOfNodes(nodeIds, (edgeId) => {
      // Check matching edge type
      if (zxType && zxType !== allEdges[edgeId].zxType) {
        throw new GraphOperationException(
          "not allowed to toggle edges of different types"
        );
      }
      // Record
      oldEdgeIds.add(edgeId);
      oldNodePairs.add(
        this.nodePairString(allEdges[edgeId].source, allEdges[edgeId].target)
      );
      // Remove existing edge
      delete this.graph.edges[edgeId];
    });
    // Remove any dependent paths
    this.clearPathsByEdges(oldEdgeIds);
    // Add in the new edges
    this.forCompleteGraph(nodeIds, (n1, n2) => {
      if (!oldNodePairs.has(this.nodePairString(n1, n2))) {
        // Add new edge
        if (zxType) {
          this.addEdge(n1, n2, zxType);
        } else if (
          this.graph.nodes[n1].zxType === "boundary" ||
          this.graph.nodes[n2].zxType === "boundary"
        ) {
          this.addNormalEdge(n1, n2);
        } else {
          this.addHadamardEdge(n1, n2);
        }
      }
    });
  }
  clearEdgesBetweenNodes(nodeIds, zxType) {
    this.forInnerEdgesOfNodes(nodeIds, (edgeId) => {
      // Check matching edge type
      if (zxType && zxType !== this.graph.edges[edgeId].zxType) {
        throw new GraphOperationException(
          "not allowed to toggle edges of different types"
        );
      }
      // Remove existing edge
      delete this.graph.edges[edgeId];
    });
  }

  deleteEdges(edges, zxType) {
    // Remove any dependent paths
    this.clearPathsByEdges(edges);
    // Remove edges
    for (const edgeId of edges) {
      if (zxType && zxType !== this.graph.edges[edgeId].zxType) {
        throw new GraphOperationException("deleting edges of the wrong type");
      }
      delete this.graph.edges[edgeId];
    }
  }

  deleteNodes(nodes) {
    const oldEdges = [];
    // Find and remove edges
    this.forEdgesOfNodes(nodes, (edgeId) => {
      oldEdges.push(edgeId);
      delete this.graph.edges[edgeId];
    });
    // Remove any dependent paths
    this.clearPathsByEdges(oldEdges);
    // Remove nodes and node position info
    for (const nodeId of nodes) {
      delete this.graph.layouts.nodes[nodeId];
      delete this.graph.nodes[nodeId];
    }
  }

  setAngle(nodeId, angle) {
    // Allow casting comparison for "0"
    if (angle && angle != 0) {
      this.graph.nodes[nodeId] = {
        ...this.graph.nodes[nodeId],
        zxAngle: angle,
      };
    } else {
      this.graph.nodes[nodeId] = { ...this.graph.nodes[nodeId] };
      delete this.graph.nodes[nodeId].zxAngle;
    }
  }

  addAngle(nodeId, a) {
    const old = this.angle(nodeId);
    if (old && old !== "0") {
      a = angleStrSum(old, a);
    }
    this.setAngle(nodeId, a);
  }

  subtractAngle(nodeId, a) {
    const old = this.angle(nodeId);
    this.setAngle(nodeId, angleStrDiff(old, a));
  }

  // Remove all paths dependent on these edges or shared nodes
  clearPathsByEdges(edges) {
    this.forPathsOfEdges(edges, (pathId) => {
      delete this.graph.paths[pathId];
    });
  }

  // Remove all paths dependent on these nodes
  clearPathsByNodes(nodes) {
    const oldEdges = [];
    // Find edges
    this.forEdgesOfNodes(nodes, (edgeId) => {
      oldEdges.push(edgeId);
    });
    // Remove any dependent paths
    this.clearPathsByEdges(oldEdges);
  }

  newPathId() {
    let pathId = `path${this.nextPathIndex}`;
    while (this.graph.paths[pathId]) {
      this.nextPathIndex *= 2;
      pathId = `path${this.nextPathIndex}`;
    }
    this.nextPathIndex += 1;
    return pathId;
  }

  addPathByEdges(edges) {
    // Throws if invalid
    const orderedEdges = this.sortValidPathEdges(edges, true);
    this.clearPathsByEdges(edges);
    this.graph.paths[this.newPathId()] = { edges: orderedEdges };
  }

  insertNewNodesAlongEdge(edge, count, zxEdgeType, zxNodeType) {
    const [n1, n2] = this.nodesOfEdge(edge);
    const [x1, y1] = this.coordsOfNode(n1);
    const [x2, y2] = this.coordsOfNode(n2);
    let prev = n1;
    let node = n1;
    const newNodes = [];
    const newEdges = [];
    for (let i = 0; i < count; i++) {
      const x = x1 + ((i + 1) * (x2 - x1)) / (count + 1);
      const y = y1 + ((i + 1) * (y2 - y1)) / (count + 1);
      node = this.addNode(zxNodeType || "z", x, y);
      newNodes.push(node);
      const auto = i === 0 && this.isBoundaryNode(n1) ? "normal" : "hadamard";
      const e = this.addEdge(prev, node, zxEdgeType || auto);
      newEdges.push(e);
      prev = node;
    }
    const auto = this.isBoundaryNode(n2) ? "normal" : "hadamard";
    const e = this.addEdge(node, n2, zxEdgeType || auto);
    newEdges.push(e);
    this.substitutePathEdge(edge, newEdges);
    this.deleteEdges([edge]);
    return [newNodes, newEdges];
  }

  substitutePathEdge(edgeId, newOrderedEdges, extraBefore, extraAfter) {
    extraBefore = extraBefore ?? 0;
    extraAfter = extraAfter ?? 0;
    assert(newOrderedEdges.length > 0, "array argument must be non-empty");
    for (const pathId of Object.keys(this.graph.paths)) {
      const i = this.graph.paths[pathId].edges.indexOf(edgeId);
      if (i >= 0) {
        const pathEdges = [...this.graph.paths[pathId].edges];
        // This path contains the edge
        // Check if need to flip extraBefore and extraAfter
        if (extraBefore > 0 || extraAfter > 0) {
          if (i <= 0) {
            const [n1] = this.nodesOfEdge(edgeId);
            const [n3, n4] = this.nodesOfEdge(pathEdges[i + 1]);
            if (n1 === n3 || n1 === n4) {
              // Edge is reverse
              [extraBefore, extraAfter] = [extraAfter, extraBefore];
            }
          } else {
            const [n1, n2] = this.nodesOfEdge(pathEdges[i - 1]);
            const [, n4] = this.nodesOfEdge(edgeId);
            if (n1 === n4 || n2 === n4) {
              // Edge is reverse
              [extraBefore, extraAfter] = [extraAfter, extraBefore];
            }
          }
        }
        // Check what order to insert newOrderedEdges
        if (i - extraBefore <= 0) {
          // Special case for the first edge
          // Check which end of the new edges the earlier edge matches with
          const [n1, n2] = this.nodesOfEdge(pathEdges[i - extraBefore + 1]);
          const [n3, n4] = this.nodesOfEdge(
            newOrderedEdges[newOrderedEdges.length - 1]
          );
          if (n1 === n3 || n1 === n4 || n2 === n3 || n2 === n4) {
            pathEdges.splice(
              i - extraBefore,
              extraBefore + 1 + extraAfter,
              ...newOrderedEdges
            );
          } else {
            pathEdges.splice(
              i - extraBefore,
              extraBefore + 1 + extraAfter,
              ...[...newOrderedEdges].reverse()
            );
          }
        } else {
          // Check which end of the new edges the earlier edge matches with
          const [n1, n2] = this.nodesOfEdge(pathEdges[i - 1]);
          const [n3, n4] = this.nodesOfEdge(newOrderedEdges[0]);
          if (n1 === n3 || n1 === n4 || n2 === n3 || n2 === n4) {
            pathEdges.splice(
              i - extraBefore,
              extraBefore + 1 + extraAfter,
              ...newOrderedEdges
            );
          } else {
            pathEdges.splice(
              i - extraBefore,
              extraBefore + 1 + extraAfter,
              ...[...newOrderedEdges].reverse()
            );
          }
        }
        // Set as new path
        delete this.graph.paths[pathId];
        this.graph.paths[this.newPathId()] = { edges: pathEdges };
      }
    }
  }
}
