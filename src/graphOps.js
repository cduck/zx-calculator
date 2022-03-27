import { ref } from "vue";
import { useGraphStore } from "@/stores/graph.js";

let graphStore = null;

// TODO: Better indexing
const nextNodeIndex = ref(null);
const nextEdgeIndex = ref(null);

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

// Graph queries
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

// Graph subroutines
const nodePairString = (n1, n2) => {
  if (n1 <= n2) {
    return `${n1}$${n2}`;
  } else {
    return `${n2}$${n1}`;
  }
};

// Graph operations
export const addNode = (zxType) => {
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
  graphStore.nodes = Object.assign(graphStore.nodes, {});
  return nodeId;
};
export const addZNode = () => {
  return addNode("z");
};
export const addXNode = () => {
  return addNode("x");
};
export const addBoundaryNode = () => {
  return addNode("boundary");
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
  addEdge(n1, n2, "normal");
};
export const addHadamardEdge = (n1, n2) => {
  addEdge(n1, n2, "hadamard");
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
  forPathsOfEdges(oldEdgeIds, (pathId) => {
    delete graphStore.paths[pathId];
  });
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

export const deleteEdges = (edges) => {
  // Remove any dependent paths
  forPathsOfEdges(edges, (pathId) => {
    delete graphStore.paths[pathId];
  });
  // Remove edges
  for (const edgeId of edges) {
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
  forPathsOfEdges(oldEdges, (pathId) => {
    delete graphStore.paths[pathId];
  });
  // Remove nodes and node position info
  for (const nodeId of nodes) {
    delete graphStore.layouts.nodes[nodeId];
    delete graphStore.nodes[nodeId];
  }
};

export const setAngle = (nodes, angle) => {
  for (const nodeId of nodes) {
    if (angle) {
      graphStore.nodes[nodeId].zxAngle = angle;
    } else {
      delete graphStore.nodes[nodeId].zxAngle;
    }
  }
};
