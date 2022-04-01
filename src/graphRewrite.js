import { assert } from "@/graphOps.js";

export function GraphRewriteException(msg) {
  this.message = msg;
}

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
    return (zxNodeType ?? "z") === "z" || zxNodeType === "x";
  }
  hEdgeToTwoNodes(edge, zxNodeType) {
    const oldType = this.graphOps.edgeType(edge);
    const [n1, n2] = this.graphOps.nodesOfEdge(edge);
    zxNodeType = zxNodeType ?? "z";
    if (zxNodeType !== "z" && zxNodeType !== "x") {
      throw new GraphRewriteException(
        `invalid node type "${zxNodeType}" not "x" or "z"`
      );
    }
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

  // Hadamard cancellation
  // The edge must be a Hadamard edge
  // The edge's two nodes must be either X- or Z-type, have degree two, and zero
  // angle
  // The result is these two nodes and three edges gone, replaced with a new
  // edge
  // This edge is Hadamard if the three removed edges had an odd Hadamard count
  // This edge is Normal otherwise
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
    if (!this.graphOps.isHadamardEdge(edge)) {
      throw new GraphRewriteException("edge must be a Hadamard edge");
    }
    const [n1, n2] = this.graphOps.nodesOfEdge(edge);
    if (!(this.graphOps.hasAngleZero(n1) && this.graphOps.hasAngleZero(n2))) {
      throw new GraphRewriteException(
        `at least one node has nonzero angle ` +
          `"${this.graphOps.angle(n1)}", "${this.graphOps.angle(n2)}"`
      );
    }
    const nodeType = this.graphOps.nodeType(n1);
    const nodeType2 = this.graphOps.nodeType(n2);
    if (nodeType !== "z" && nodeType !== "x") {
      throw new GraphRewriteException(
        `node has invalid type ${nodeType} not "x" or "z"`
      );
    }
    if (nodeType2 !== "z" && nodeType2 !== "x") {
      throw new GraphRewriteException(
        `node has invalid type ${nodeType2} not "x" or "z"`
      );
    }
    const neighbors = {};
    let hCount = true;
    this.graphOps.forEdgesOfNodes([n1, n2], (e) => {
      const [n3, n4] = this.graphOps.nodesOfEdge(e);
      if (e !== edge) {
        assert(!(n1 === n3 && n2 === n4), "edge is a multi-edge");
        neighbors[n3] = (neighbors[n3] ?? 0) + 1;
        neighbors[n4] = (neighbors[n4] ?? 0) + 1;
        if (this.graphOps.isHadamardEdge(e)) {
          hCount = !hCount;
        } else if (!this.graphOps.isNormalEdge(e)) {
          throw new GraphRewriteException(
            `disallowed edge type "${this.graphOps.edgeType(e)}"`
          );
        }
      }
    });
    if (!(neighbors[n1] && neighbors[n2])) {
      throw new GraphRewriteException("both nodes are not degree 2");
    }
    delete neighbors[n1];
    delete neighbors[n2];
    const nList = Object.keys(neighbors);
    if (nList.length != 2) {
      throw new GraphRewriteException("both nodes are not degree 2");
    }
    const [n3, n4] = nList;
    if (!(neighbors[n3] === 1 && neighbors[n4] === 1)) {
      throw new GraphRewriteException("neighboring edge is a multi-edge");
    }
    // Perform graph modification
    if (!dryRun) {
      //this.graphOps.substitutePathEdge();
      this.graphOps.deleteNodes([n1, n2]);
      if (hCount) {
        return this.graphOps.addHadamardEdge(n3, n4);
      } else {
        return this.graphOps.addNormalEdge(n3, n4);
      }
    }
  }

  // Hadamard cancellation
  // The node must have degree-2 with both edges the same type and have zero
  // angle
  // The two neighbors must have equal types, X or Z, not necessarily the same
  // as the given node
  // The result is the two neighbor nodes merged into one with summed angles
  removeDegree2NodeWithHEdgesIsValid(node) {
    try {
      this.removeDegree2NodeWithHEdges(node, true);
    } catch (e) {
      if (e instanceof GraphRewriteException) return false;
      throw e;
    }
    return true;
  }
  removeDegree2NodeWithHEdges(node, dryRun) {
    if (!this.graphOps.hasAngleZero(node)) {
      throw new GraphRewriteException("node has nonzero angle");
    }
    if (!(this.graphOps.isZNode(node) || this.graphOps.isXNode(node))) {
      throw new GraphRewriteException("");
    }
    const neighbors = new Set();
    const types = new Set();
    this.graphOps.forEdgesOfNodes([node], (edgeId) => {
      if (!this.graphOps.isHadamardEdge(edgeId)) {
        throw new GraphRewriteException("node's edge is not a Hadamard edge");
      }
      let [n1, n2] = this.graphOps.nodesOfEdge(edgeId);
      if (n1 === node) {
        n1 = n2;
      }
      if (neighbors.has(n1)) {
        throw new GraphRewriteException("node has a multi-edge");
      }
      neighbors.add(n1);
      types.add(this.graphOps.nodeType(n1));
    });
    if (neighbors.has(node)) {
      throw new GraphRewriteException("node has a self-loop");
    }
    if (neighbors.size != 2) {
      throw new GraphRewriteException("node is not degree-2");
    }
    if (types.size !== 1) {
      throw new GraphRewriteException("neighbors types do not match");
    }
    if (["z", "x"].indexOf([...types][0]) < 0) {
      throw new GraphRewriteException(
        `neighbors have invalid type "${[...types][0]}"`
      );
    }
    const [n1, n2] = neighbors;
    if (!dryRun) {
      this.graphOps.forEdgesOfNodes([n2], (edgeId) => {
        let [n3, n4] = this.graphOps.nodesOfEdge(edgeId);
        if (n4 === n2) {
          [n3, n4] = [n4, n3];
        }
        if (n3 !== node) {
          this.graphOps.addEdge(n1, n4, this.graphOps.edgeType(edgeId));
        }
      });
      //this.graphOps.substitutePathEdge();
      this.graphOps.addAngle(n1, this.graphOps.angle(n2));
      this.graphOps.deleteNodes([node, n2]);
    }
    return n1;
  }

  // Local complementation
  // The node must have an angle
}
