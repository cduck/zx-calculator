export function GraphRewriteException(msg) {
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

export class GraphRewrite {
  constructor(graphOps) {
    this.graphOps = graphOps;
  }

  // Reverse Hadamard cancellation
  // Works on any edge type (hadamard or normal) with any nodes
  // Argument zxNodeType may be "z" (default) or "x"
  // If a normal edge with a boundary node, makes sure the new normal edge is
  // still connected to the boundary
  hEdgeToTwoNodesIsValid(edge, zxNodeType) {
    try {
      this.hEdgeToTwoNodes(edge, zxNodeType, true);
    } catch (e) {
      if (e instanceof GraphRewriteException) return false;
      throw e;
    }
    return true;
  }
  hEdgeToTwoNodes(edge, zxNodeType, dryRun) {
    zxNodeType = zxNodeType ?? "z";
    const oldType = this.graphOps.edgeType(edge);
    const [n1, n2] = this.graphOps.nodesOfEdge(edge);
    if (!(zxNodeType === "z" || zxNodeType === "x")) {
      throw new GraphRewriteException(
        `invalid node type "${zxNodeType}" not "x" or "z"`
      );
    }
    if (
      oldType !== "hadamard" &&
      !this.graphOps.isZOrXNode(n1) &&
      !this.graphOps.isZOrXNode(n2)
    ) {
      throw new GraphRewriteException("too many boundary nodes!");
    }
    if (!dryRun) {
      const [newNodes, newEdges] = this.graphOps.insertNewNodesAlongEdge(
        edge,
        2,
        "hadamard",
        zxNodeType
      );
      if (oldType !== "hadamard") {
        if (
          this.graphOps.isBoundaryNode(n2) &&
          !this.graphOps.isBoundaryNode(n1)
        ) {
          this.graphOps.setEdgeType(newEdges[newEdges.length - 1], oldType);
        } else {
          this.graphOps.setEdgeType(newEdges[0], oldType);
        }
      }
      return [newNodes, newEdges];
    }
  }

  // Hadamard cancellation
  // The edge must be a Hadamard edge
  // The edge's two nodes must be either X- or Z-type, each have two Hadamard
  // edges, and zero angle
  // TODO: Some other constraints
  removeHEdgeWithDegree2NodesIsValid(edge) {
    try {
      this.removeHEdgeWithDegree2Nodes(edge, true);
    } catch (e) {
      if (e instanceof GraphRewriteException) return false;
      throw e;
    }
    return true;
  }
  removeHEdgeWithDegree2Nodes(edge, dryRun) {
    const [n1, n2] = this.graphOps.nodesOfEdge(edge);
    try {
      this.removeDegree2NodeWithHEdges(n1, undefined, dryRun);
      // TODO: return new edge
    } catch (e) {
      if (!(e instanceof GraphRewriteException)) throw e;
      this.removeDegree2NodeWithHEdges(n2, undefined, dryRun);
      // TODO: return new edge
    }
  }

  // Hadamard cancellation
  // The node must have degree-2 with both edges the same type and have zero
  // angle
  // The two neighbors must have equal types, X or Z, not necessarily the same
  // as the given node
  // The result is the two neighbor nodes merged into one with summed angles
  removeDegree2NodeWithHEdgesIsValid(node, preferredEdge) {
    try {
      this.removeDegree2NodeWithHEdges(node, preferredEdge, true);
    } catch (e) {
      if (e instanceof GraphRewriteException) return false;
      throw e;
    }
    return true;
  }
  removeDegree2NodeWithHEdges(node, preferredEdge, dryRun) {
    if (!(this.graphOps.isZOrXNode(node) && this.graphOps.hasAngleZero(node))) {
      throw new GraphRewriteException(
        "node is not Z or X or has a nonzero angle"
      );
    }
    const neighbors = new Set();
    const edges = new Set();
    let nodeType;
    this.graphOps.forEdgesOfNodes([node], (edge) => {
      if (!this.graphOps.isHadamardEdge(edge)) {
        throw new GraphRewriteException("node has a non-Hadamard edge");
      }
      const [maybe1, maybe2] = this.graphOps.nodesOfEdge(edge);
      const n1 = maybe1 === node ? maybe2 : maybe1;
      const n1Type = this.graphOps.nodeType(n1);
      if (n1 === node) {
        throw new GraphRewriteException("node has a self-loop");
      }
      if (neighbors.has(n1)) {
        throw new GraphRewriteException("node has a multi-edge");
      }
      if (edges.size >= 2) {
        throw new GraphRewriteException("node has more than 2 edges");
      }
      if (!this.graphOps.isZOrXNode(n1)) {
        throw new GraphRewriteException("node neighbor is not Z- or X-type");
      }
      if (nodeType && nodeType !== n1Type) {
        throw new GraphRewriteException("node neighbor types do not match");
      }
      nodeType = n1Type;
      neighbors.add(n1);
      edges.add(edge);
    });
    if (neighbors.size !== 2) {
      throw new GraphRewriteException("node has fewer than 2 neighbors");
    }
    // Used to pick which new edge to return
    //const [n1, n2] = this.graphOps.nodesOfEdge(preferredEdge);
    //const preferredNode = n1 === node ? n2 : n1;
    if (!dryRun) {
      // Merge these nodes by deleting nOther and transferring its edges
      const [nMerge, nOther] = neighbors;
      const oldTransfer = [];
      const newTransfer = [];
      let rmEdge;
      // Add edges
      this.graphOps.forEdgesOfNodesMutate([nOther], (edge) => {
        const [n1, n2] = this.graphOps.nodesOfEdge(edge);
        if (n1 === node || n2 === node) {
          rmEdge = edge;
        } else {
          const n = n1 === nOther ? n2 : n1;
          const newEdge = this.graphOps.isHadamardEdge(edge)
            ? this.graphOps.toggleHadamardEdgeHandleSelfLoop(
                nMerge,
                n,
                this.graphOps.edgeType(edge)
              ) ?? null
            : this.graphOps.addEdge(nMerge, n, this.graphOps.edgeType(edge));
          oldTransfer.push(edge);
          newTransfer.push(newEdge);
        }
      });
      // Adjust paths
      this.graphOps.forPathsOfEdges(oldTransfer, (pathId) => {
        const pathEdges = this.graphOps.pathEdges(pathId);
        const transerIdx = [];
        for (let i = 0; i < oldTransfer.length; i++) {
          if (pathEdges.indexOf(oldTransfer[i]) >= 0) {
            transerIdx.push(i);
          }
        }
        if (transerIdx.length === 1) {
          // Path goes through the given node
          if (pathEdges.indexOf(rmEdge) < 0) {
            throw new GraphRewriteException("disconnected path nearby (1)");
          }
          const pedge = oldTransfer[transerIdx[0]];
          const nedge = newTransfer[transerIdx[0]];
          const [n1] = this.graphOps.nodesOfEdge(pedge);
          if (n1 === nOther) {
            // Forward path
            this.graphOps.substitutePathEdge(pedge, [nedge], 2, 0);
          } else {
            // Reverse path
            this.graphOps.substitutePathEdge(pedge, [nedge], 0, 2);
          }
        } else if (transerIdx.length === 2) {
          // Path only goes through the merged neighbor node
          const pedge1 = oldTransfer[transerIdx[0]];
          const pedge2 = oldTransfer[transerIdx[1]];
          const nedge1 = newTransfer[transerIdx[0]];
          const nedge2 = newTransfer[transerIdx[1]];
          const e1SelfLoop =
            !nedge1 && this.graphOps.nodesOfEdge(pedge1).indexOf(nMerge) >= 0;
          const e2SelfLoop =
            !nedge2 && this.graphOps.nodesOfEdge(pedge2).indexOf(nMerge) >= 0;
          let inserted = [nedge1, nedge2];
          if (e1SelfLoop) {
            inserted = [nedge2];
          } else if (e2SelfLoop) {
            inserted = [nedge1];
          } else if (!nedge1 || !nedge2) {
            // Cannot adjust path because all connecting edges were deleted
            console.warn("Failed to preserve path");
            return; // Don't adjust path, let it be deleted
          }
          const [, n2] = this.graphOps.nodesOfEdge(pedge1);
          if (n2 === nOther) {
            // Forward path
            this.graphOps.substitutePathEdge(pedge1, inserted, 0, 1);
          } else {
            // Reverse path
            this.graphOps.substitutePathEdge(pedge1, inserted, 1, 0);
          }
        } else if (transerIdx.length > 2) {
          // Too many matched edges
          throw new GraphRewriteException("malformed path nearby");
        } else {
          assert(false, "forPathOfEdges matched without any matching edges");
        }
      });
      // Move merged node to average of old positions
      const nodePositions = this.graphOps.graph.layouts.nodes;
      if (nodePositions[nMerge] && nodePositions[nOther]) {
        nodePositions[nMerge].x +=
          (nodePositions[nOther].x - nodePositions[nMerge].x) / 2;
        nodePositions[nMerge].y +=
          (nodePositions[nOther].y - nodePositions[nMerge].y) / 2;
      }
      // Delete nodes and edges
      this.graphOps.deleteNodes([node, nOther]);
      return nMerge;
    }
  }

  // Local complementation
  // The node must have an angle
}
