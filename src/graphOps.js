import { ref } from "vue";
import { useGraphStore } from "@/stores/graph.js";

let graphStore = null;

// TODO: Better indexing
const nextNodeIndex = ref(null);
const nextEdgeIndex = ref(null);
const nextPathIndex = ref(null);

// Setup after load
export const graphOpsSetup = () => {
  graphStore = useGraphStore();
  nextNodeIndex.value = Object.keys(graphStore.nodes).length + 1;
  nextEdgeIndex.value = Object.keys(graphStore.nodes).length + 1;
};

// Graph exceptions
export function GraphOperationException(msg) {
  this.message = msg;
}

export function AssertionError(msg) {
  this.message = msg;
}
const assert = (condition, msg) => {
  if (!condition) {
    throw new AssertionError(msg);
  }
};

////////// Graph tests //////////
export const isBoundaryNode = (nodeId) => {
  return graphStore.nodes[nodeId].zxType === "boundary";
};

export const isEdgesValidPath = (edgeIds, ignoreCurrent) => {
  const orderedEdges = _isEdgesValidPathHelper(edgeIds, ignoreCurrent);
  return typeof orderedEdges !== "string";
};
export const sortValidPathEdges = (edgeIds, ignoreCurrent) => {
  const orderedEdges = _isEdgesValidPathHelper(edgeIds, ignoreCurrent);
  if (typeof orderedEdges === "string") {
    throw new GraphOperationException(orderedEdges);
  }
  return orderedEdges;
};
export const isEdgesValidPathReason = (edgeIds, ignoreCurrent) => {
  const orderedEdges = _isEdgesValidPathHelper(edgeIds, ignoreCurrent);
  if (typeof orderedEdges === "string") {
    return orderedEdges;
  } else {
    return "valid path";
  }
};
export const _isEdgesValidPathHelper = (edgeIds, ignoreCurrent) => {
  if (edgeIds.length < 1) {
    return "empty path";
  }

  if (!ignoreCurrent) {
    let overlap = false;
    forPathsOfEdges(edgeIds, () => {
      overlap = true;
    });
    if (overlap) {
      return "path overlaps with current";
    }
  }

  const counts = {};
  const orderedNodes = [];
  const neighbors = {};
  const nodePairToEid = {};
  // Count nodes used by edges to determine path properties
  for (const eid of edgeIds) {
    const [n1, n2] = nodesOfEdge(eid);
    assert(n1 !== n2, "graph self loop");
    nodePairToEid[nodePairString(n1, n2)] = eid;
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
      if (!isBoundaryNode(nid)) {
        return "path ends must be boundary nodes";
      }
      endNodes.push(nid);
    } else {
      // counts[nid] == 2
      if (isBoundaryNode(nid)) {
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
    finalEdges.push(nodePairToEid[nodePairString(prev, current)]);
  }
  if (finalEdges.length != edgeIds.length) {
    return "path is a valid path but with one or more disconnected loops";
  }
  return finalEdges;
};

////////// Graph queries //////////
export const nodesOfEdge = (edgeId) => {
  return [graphStore.edges[edgeId].source, graphStore.edges[edgeId].target];
};

export const coordsOfNode = (nodeId) => {
  const coords = graphStore.layouts.nodes[nodeId];
  return [coords.x, coords.y];
};

export const degree = (nodeId) => {
  let deg = 0;
  forEdgesOfNodes([nodeId], () => {
    deg += 1;
  });
  return deg;
};

export const nodeIsPlusMinusPi2 = (nodeId) => {
  // TODO: Symbolic math
  const angle = graphStore.nodes[nodeId].zxAngle;
  return ["pi/2", "-pi/2", "π/2", "-π/2"].indexOf(angle) >= 0;
};

export const isNodeNearBoundary = (nodeId) => {
  if (isBoundaryNode(nodeId)) {
    // Shortcut if this node is a boundary
    return true;
  }
  let near = false;
  forNodeCollectiveNeighborhood([nodeId], (n) => {
    if (isBoundaryNode(n)) {
      near = true;
    }
  });
  return near;
};

// Calls callback for every edge that uses at least one node
export const forEdgesOfNodes = (nodeIds, callback) => {
  const nodeIdSet = nodeIds instanceof Set ? nodeIds : new Set(nodeIds);
  const edges = graphStore.edges;
  for (const edgeId of Object.keys(edges)) {
    if (
      nodeIdSet.has(edges[edgeId].source) ||
      nodeIdSet.has(edges[edgeId].target)
    ) {
      callback(edgeId);
    }
  }
};

// Calls callback for every edge that uses at least two nodes
export const forInnerEdgesOfNodes = (nodeIds, callback) => {
  const nodeIdSet = nodeIds instanceof Set ? nodeIds : new Set(nodeIds);
  const edges = graphStore.edges;
  for (const edgeId of Object.keys(edges)) {
    if (
      nodeIdSet.has(edges[edgeId].source) &&
      nodeIdSet.has(edges[edgeId].target)
    ) {
      callback(edgeId);
    }
  }
};

// Calls callback for every path that uses at least one edge
export const forPathsOfEdges = (edgeIds, callback) => {
  const paths = graphStore.paths;
  for (const pathId of Object.keys(paths)) {
    const pathEdgeSet = new Set(paths[pathId].edges);
    inner: for (const edgeId of edgeIds) {
      if (pathEdgeSet.has(edgeId)) {
        callback(pathId);
        break inner;
      }
    }
  }
};

// Calls callback for every (sorted) pair of nodes
export const forCompleteGraph = (nodeIds, callback) => {
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
};

// Calls callback for every neighbor other than those in nodeIds
export const forNodeCollectiveNeighborhood = (nodeIds, callback) => {
  const nodeIdSet = nodeIds instanceof Set ? nodeIds : new Set(nodeIds);
  for (let eid of Object.keys(graphStore.edges)) {
    const [n1, n2] = nodesOfEdge(eid);
    if (nodeIdSet.has(n1) && !nodeIdSet.has(n2)) {
      callback(n2);
    } else if (nodeIdSet.has(n2) && !nodeIdSet.has(n1)) {
      callback(n1);
    }
  }
};

////////// Graph subroutines //////////
const nodePairString = (n1, n2) => {
  if (n1 <= n2) {
    return `${n1}$${n2}`;
  } else {
    return `${n2}$${n1}`;
  }
};

////////// Graph operations //////////
export const addNode = (zxType, x, y) => {
  assert(zxType, "required argument");
  let nodeId = `node${nextNodeIndex.value}`;
  while (graphStore.nodes[nodeId]) {
    nextNodeIndex.value *= 2;
    nodeId = `node${nextNodeIndex.value}`;
  }
  nextNodeIndex.value += 1;
  graphStore.nodes[nodeId] = {
    zxType: zxType,
  };
  if (x !== undefined && y !== undefined) {
    graphStore.layouts.nodes[nodeId] = { x: x, y: y };
  }
  return nodeId;
};
export const addZNode = (x, y) => {
  return addNode("z", x, y);
};
export const addXNode = (x, y) => {
  return addNode("x", x, y);
};
export const addBoundaryNode = (x, y) => {
  return addNode("boundary", x, y);
};

export const addEdge = (n1, n2, zxType) => {
  assert(zxType, "required argument");
  let edgeId = `edge${nextEdgeIndex.value}`;
  while (graphStore.edges[edgeId]) {
    nextEdgeIndex.value *= 2;
    edgeId = `edge${nextEdgeIndex.value}`;
  }
  nextEdgeIndex.value += 1;
  if (n2 > n1) {
    [n1, n2] = [n2, n1];
  }
  graphStore.edges[edgeId] = {
    source: n1,
    target: n2,
    zxType: zxType,
  };
  return edgeId;
};
export const addNormalEdge = (n1, n2) => {
  return addEdge(n1, n2, "normal");
};
export const addHadamardEdge = (n1, n2) => {
  return addEdge(n1, n2, "hadamard");
};

// If zxType is undefined, uses normal edges only to boundary nodes
// If zxType, enforces this type for removed edges
export const toggleEdges = (nodeIds, zxType) => {
  const allEdges = graphStore.edges;
  const oldEdgeIds = new Set();
  const oldNodePairs = new Set();
  forInnerEdgesOfNodes(nodeIds, (edgeId) => {
    // Check matching edge type
    if (zxType && zxType !== allEdges[edgeId].zxType) {
      throw new GraphOperationException(
        "not allowed to toggle edges of different types"
      );
    }
    // Record
    oldEdgeIds.add(edgeId);
    oldNodePairs.add(
      nodePairString(allEdges[edgeId].source, allEdges[edgeId].target)
    );
    // Remove existing edge
    delete graphStore.edges[edgeId];
  });
  // Remove any dependent paths
  clearPathsByEdges(oldEdgeIds);
  // Add in the new edges
  forCompleteGraph(nodeIds, (n1, n2) => {
    if (!oldNodePairs.has(nodePairString(n1, n2))) {
      // Add new edge
      if (zxType) {
        addEdge(n1, n2, zxType);
      } else if (
        graphStore.nodes[n1].zxType === "boundary" ||
        graphStore.nodes[n2].zxType === "boundary"
      ) {
        addNormalEdge(n1, n2);
      } else {
        addHadamardEdge(n1, n2);
      }
    }
  });
};
export const clearEdgesBetweenNodes = (nodeIds, zxType) => {
  forInnerEdgesOfNodes(nodeIds, (edgeId) => {
    // Check matching edge type
    if (zxType && zxType !== graphStore.edges[edgeId].zxType) {
      throw new GraphOperationException(
        "not allowed to toggle edges of different types"
      );
    }
    // Remove existing edge
    delete graphStore.edges[edgeId];
  });
};

export const deleteEdges = (edges, zxType) => {
  // Remove any dependent paths
  clearPathsByEdges(edges);
  // Remove edges
  for (const edgeId of edges) {
    if (zxType && zxType !== graphStore.edges[edgeId].zxType) {
      throw new GraphOperationException("deleting edges of the wrong type");
    }
    delete graphStore.edges[edgeId];
  }
};

export const deleteNodes = (nodes) => {
  const oldEdges = [];
  // Find and remove edges
  forEdgesOfNodes(nodes, (edgeId) => {
    oldEdges.push(edgeId);
    delete graphStore.edges[edgeId];
  });
  // Remove any dependent paths
  clearPathsByEdges(oldEdges);
  // Remove nodes and node position info
  for (const nodeId of nodes) {
    delete graphStore.layouts.nodes[nodeId];
    delete graphStore.nodes[nodeId];
  }
};

export const setAngle = (nodes, angle) => {
  for (const nodeId of nodes) {
    if (angle) {
      graphStore.nodes[nodeId] = {
        ...graphStore.nodes[nodeId],
        zxAngle: angle,
      };
    } else {
      delete graphStore.nodes[nodeId].zxAngle;
    }
  }
};

// Remove all paths dependent on these edges
export const clearPathsByEdges = (edges) => {
  forPathsOfEdges(edges, (pathId) => {
    delete graphStore.paths[pathId];
  });
};

// Remove all paths dependent on these nodes
export const clearPathsByNodes = (nodes) => {
  const oldEdges = [];
  // Find edges
  forEdgesOfNodes(nodes, (edgeId) => {
    oldEdges.push(edgeId);
  });
  // Remove any dependent paths
  clearPathsByEdges(oldEdges);
};

const newPathId = () => {
  let pathId = `edge${nextPathIndex.value}`;
  while (graphStore.paths[pathId]) {
    nextPathIndex.value *= 2;
    pathId = `edge${nextPathIndex.value}`;
  }
  nextPathIndex.value += 1;
  return pathId;
};

export const addPathByEdges = (edges) => {
  const orderedEdges = sortValidPathEdges(edges, true); // Throws if invalid
  clearPathsByEdges(edges);
  graphStore.paths[newPathId()] = { edges: orderedEdges };
};

export const insertNewNodesAlongEdge = (
  edge,
  count,
  zxEdgeType,
  zxNodeType
) => {
  const [n1, n2] = nodesOfEdge(edge);
  const [x1, y1] = coordsOfNode(n1);
  const [x2, y2] = coordsOfNode(n2);
  let prev = n1;
  let node = n1;
  const newNodes = [];
  const newEdges = [];
  for (let i = 0; i < count; i++) {
    const x = x1 + ((i + 1) * (x2 - x1)) / (count + 1);
    const y = y1 + ((i + 1) * (y2 - y1)) / (count + 1);
    node = addNode(zxNodeType || "z", x, y);
    newNodes.push(node);
    const auto = i === 0 && isBoundaryNode(n1) ? "normal" : "hadamard";
    const e = addEdge(prev, node, zxEdgeType || auto);
    newEdges.push(e);
  }
  const auto = isBoundaryNode(n2) ? "normal" : "hadamard";
  const e = addEdge(node, n2, zxEdgeType || auto);
  newEdges.push(e);
  substitutePathEdge(edge, newEdges);
  deleteEdges([edge], zxEdgeType);
  return newNodes;
};

export const substitutePathEdge = (edgeId, newOrderedEdges) => {
  assert(newOrderedEdges.length > 0, "array argument must be non-empty");
  for (const pathId of Object.keys(graphStore.paths)) {
    const pathEdges = graphStore.paths[pathId].edges;
    const i = pathEdges.indexOf(edgeId);
    if (i >= 0) {
      // This path contains the edge
      // Check what order to insert newOrderedEdges
      if (i == 0) {
        // Special case for the first edge
        // Check which end of the new edges the earlier edge matches with
        const [n1, n2] = nodesOfEdge(pathEdges[i + 1]);
        const [n3, n4] = nodesOfEdge(
          newOrderedEdges[newOrderedEdges.length - 1]
        );
        if (n1 === n3 || n1 === n4 || n2 === n3 || n2 === n4) {
          pathEdges.splice(i, 1, ...newOrderedEdges);
        } else {
          pathEdges.splice(i, 1, ...newOrderedEdges.reverse());
        }
      } else {
        // Check which end of the new edges the earlier edge matches with
        const [n1, n2] = nodesOfEdge(pathEdges[i - 1]);
        const [n3, n4] = nodesOfEdge(newOrderedEdges[0]);
        if (n1 === n3 || n1 === n4 || n2 === n3 || n2 === n4) {
          pathEdges.splice(i, 1, ...newOrderedEdges);
        } else {
          pathEdges.splice(i, 1, ...newOrderedEdges.reverse());
        }
      }
      // Set as new path
      delete graphStore.paths[pathId];
      graphStore.paths[newPathId()] = { edges: pathEdges };
    }
  }
};
