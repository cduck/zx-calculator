import {
  ANGLE_ZERO,
  ANGLE_PI,
  ANGLE_PI_DIV2,
  ANGLE_PI_DIVN2,
} from "@/angles.js";

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
  // Either of the edge's two nodes must satisfy the constraints of
  // removeDegree2NodeWithHEdges
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
      return this.removeDegree2NodeWithHEdges(n1, edge, dryRun);
    } catch (e) {
      if (!(e instanceof GraphRewriteException)) throw e;
      return this.removeDegree2NodeWithHEdges(n2, edge, dryRun);
    }
  }

  // Hadamard cancellation
  // The node must have degree-2 with both edges the same type and have zero
  // angle
  // The two neighbors must have equal types, X or Z, not necessarily the same
  // as the given node
  // The result is the two neighbor nodes merged into one with summed angles
  removeDegree2NodeWithHEdgesIsValid(node, startingEdge) {
    try {
      this.removeDegree2NodeWithHEdges(node, startingEdge, true);
    } catch (e) {
      if (e instanceof GraphRewriteException) return false;
      throw e;
    }
    return true;
  }
  removeDegree2NodeWithHEdges(node, startingEdge, dryRun) {
    if (!(this.graphOps.isZOrXNode(node) && this.graphOps.hasAngleZero(node))) {
      throw new GraphRewriteException(
        "node is not Z- or X-type or has a nonzero angle"
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
    if (!dryRun) {
      // Merge these nodes by deleting nOther and transferring its edges
      let [nMerge, nOther] = neighbors;
      if (startingEdge) {
        // Used to control which new edge to return
        const [t1, t2] = this.graphOps.nodesOfEdge(startingEdge);
        const preferredNode = t1 === node ? t2 : t1;
        if (preferredNode !== nOther) {
          [nMerge, nOther] = [nOther, nMerge];
        }
      }
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
            ? this.graphOps.toggleHadamardEdgeHandleSelfLoop(nMerge, n) ?? null
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
          assert(false, "forPathsOfEdges matched without any matching edges");
        }
      });
      // Move merged node to average of old positions
      if (!startingEdge) {
        const nodePositions = this.graphOps.graph.layouts.nodes;
        if (nodePositions[nMerge] && nodePositions[nOther]) {
          nodePositions[nMerge].x +=
            (nodePositions[nOther].x - nodePositions[nMerge].x) / 2;
          nodePositions[nMerge].y +=
            (nodePositions[nOther].y - nodePositions[nMerge].y) / 2;
        }
      }
      // Sum angles
      this.graphOps.addAngle(nMerge, this.graphOps.angle(nOther));
      // Delete nodes and edges
      this.graphOps.deleteNodes([node, nOther]);
      // Return a useful output
      if (startingEdge) {
        return newTransfer.filter((e) => e !== null);
      } else {
        return nMerge;
      }
    }
  }

  // Split node
  splitNodeIsValid(node, leftEdges, leftAngle, newNodeZxType) {
    try {
      this.splitNode(node, leftEdges, leftAngle, newNodeZxType, true);
    } catch (e) {
      if (e instanceof GraphRewriteException) return false;
      throw e;
    }
    return true;
  }
  splitNode(node, leftEdges, leftAngle, newNodeZxType, dryRun) {
    if (
      !node &&
      (!leftEdges || leftEdges.length <= 0 || typeof leftEdges === "string")
    ) {
      throw new GraphRewriteException("node or leftEdges argument is required");
    }
    if (node && !this.graphOps.isZOrXNode(node)) {
      throw new GraphRewriteException("node is not Z- or X-type");
    }
    if (dryRun) {
      return;
    }
    newNodeZxType = newNodeZxType ?? "z";
    let rightEdges = [];
    let leftNodes = [];
    let rightNodes = [];
    let doGadget = false;
    if (leftEdges && typeof leftEdges !== "string") {
      if (!node) {
        // Pick the node to split
        const nodeCounts = {};
        let maxCount = 0;
        let maxX = -Infinity;
        let maxY = -Infinity;
        let maxNode = null;
        for (const edge of leftEdges) {
          for (const n1 of this.graphOps.nodesOfEdge(edge)) {
            if (!this.graphOps.isZOrXNode(n1)) continue;
            const [x1, y1] = this.graphOps.locationXY(n1);
            nodeCounts[n1] = (nodeCounts[n1] ?? 0) + 1;
            if (
              nodeCounts[n1] > maxCount ||
              (nodeCounts[n1] === maxCount &&
                (x1 > maxX || (x1 === maxX && y1 > maxY)))
            ) {
              maxCount = nodeCounts[n1];
              maxX = x1;
              maxY = y1;
              maxNode = n1;
            }
          }
        }
        node = maxNode;
        if (!this.graphOps.isZOrXNode(node)) {
          console.warn("split node is not Z- or X-type");
          return node;
        }
      }
      // rightEdges are all edges not listed in leftEdges
      const actualLeftEdges = [];
      this.graphOps.forEdgesOfNodes([node], (edge) => {
        const [n1, n2] = this.graphOps.nodesOfEdge(edge);
        const neighbor = n1 === node ? n2 : n1;
        if (leftEdges.indexOf(edge) < 0) {
          rightEdges.push(edge);
          rightNodes.push(neighbor);
        } else {
          actualLeftEdges.push(edge);
          leftNodes.push(neighbor);
        }
      });
      // Ignore any edges not touching the node
      leftEdges = actualLeftEdges;
    } else if (typeof leftEdges === "string") {
      if (leftEdges === "all") {
        doGadget = true;
        leftEdges = [];
        this.graphOps.forEdgesOfNodes([node], (edge) => {
          const [n1, n2] = this.graphOps.nodesOfEdge(edge);
          const neighbor = n1 === node ? n2 : n1;
          leftEdges.push(edge);
          leftNodes.push(neighbor);
        });
      } else {
        throw new GraphRewriteException(
          `unknown leftEdges code "${leftEdges}"`
        );
      }
    } else {
      // leftEdges are all edges with smaller locationX, others are right
      // (with ties broken by locationY)
      const [nodeX, nodeY] = this.graphOps.locationXY(node);
      leftEdges = [];
      this.graphOps.forEdgesOfNodes([node], (edge) => {
        const [n1, n2] = this.graphOps.nodesOfEdge(edge);
        const neighbor = n1 === node ? n2 : n1;
        const [x, y] = this.graphOps.locationXY(neighbor);
        if (x < nodeX || (x === nodeX && y < nodeY)) {
          leftEdges.push(edge);
          leftNodes.push(neighbor);
        } else {
          rightEdges.push(edge);
          rightNodes.push(neighbor);
        }
      });
      // If only two edges, always separate the two edges
      if (leftEdges.length === 0 && rightEdges.length === 2) {
        leftEdges = [rightEdges[0]];
        leftNodes = [rightNodes[0]];
        rightEdges = [rightEdges[1]];
        rightNodes = [rightNodes[1]];
      } else if (leftEdges.length === 2 && rightEdges.length === 0) {
        rightEdges = [leftEdges[1]];
        rightNodes = [leftNodes[1]];
        leftEdges = [leftEdges[0]];
        leftNodes = [leftNodes[0]];
      }
    }
    // Calculate new node positions
    let [nodeX, nodeY] = this.graphOps.locationXY(node);
    let [leftX, leftY] = this.graphOps.locationXY(node);
    for (const n of leftNodes) {
      leftX += this.graphOps.locationX(n);
      leftY += this.graphOps.locationY(n);
    }
    leftX /= leftNodes.length + 1;
    leftY /= leftNodes.length + 1;
    if (Math.abs(leftX - nodeX) + Math.abs(leftY - nodeY) <= 12) {
      leftX -= 24;
    }
    let [rightX, rightY] = this.graphOps.locationXY(node);
    for (const n of rightNodes) {
      rightX += this.graphOps.locationX(n);
      rightY += this.graphOps.locationY(n);
    }
    rightX /= rightNodes.length + 1;
    rightY /= rightNodes.length + 1;
    if (Math.abs(rightX - nodeX) + Math.abs(rightY - nodeY) <= 12) {
      rightX += 24;
    }
    if (doGadget) {
      [leftX, leftY] = this.graphOps.locationXY(node);
      nodeX = leftX + 24;
      nodeY = leftY - 24;
      rightX = nodeX;
      rightY = nodeY - 24;
    }
    // Add and move nodes
    const split = this.graphOps.addNode(
      this.graphOps.nodeType(node),
      leftX,
      leftY
    );
    const newNode = this.graphOps.addNode(newNodeZxType, nodeX, nodeY);
    this.graphOps.setLocation(node, rightX, rightY);
    this.graphOps.subtractAngle(node, leftAngle);
    this.graphOps.setAngle(split, leftAngle);
    // Add edges
    const newE1 = this.graphOps.addHadamardEdge(split, newNode);
    const newE2 = this.graphOps.addHadamardEdge(newNode, node);
    // Transfer edges to split node
    const oldTransfer = leftEdges;
    const newTransfer = [];
    for (let i = 0; i < oldTransfer.length; i++) {
      const eType = this.graphOps.edgeType(oldTransfer[i]);
      const newEdge = this.graphOps.addEdge(leftNodes[i], split, eType);
      newTransfer.push(newEdge);
    }
    // Update any paths
    this.graphOps.forPathsOfEdges(oldTransfer, (pathId) => {
      const pathEdges = this.graphOps.pathEdges(pathId);
      const transerIdx = [];
      for (let i = 0; i < oldTransfer.length; i++) {
        if (pathEdges.indexOf(oldTransfer[i]) >= 0) {
          transerIdx.push(i);
        }
      }
      if (transerIdx.length === 1) {
        // Path goes through from left to right
        const pedge = oldTransfer[transerIdx[0]];
        const nedge = newTransfer[transerIdx[0]];
        this.graphOps.substitutePathEdge(pedge, [nedge, newE1, newE2]);
      } else if (transerIdx.length === 2) {
        // Path goes from a left edge and out another left edge
        const pedge1 = oldTransfer[transerIdx[0]];
        const nedge1 = newTransfer[transerIdx[0]];
        const nedge2 = newTransfer[transerIdx[1]];
        const [, n2] = this.graphOps.nodesOfEdge(pedge1);
        if (n2 === node) {
          // Forward path
          this.graphOps.substitutePathEdge(pedge1, [nedge1, nedge2], 0, 1);
        } else {
          // Reverse path
          this.graphOps.substitutePathEdge(pedge1, [nedge1, nedge2], 1, 0);
        }
      } else if (transerIdx.length > 2) {
        // Too many matched edges
        throw new GraphRewriteException("malformed path nearby");
      } else {
        assert(false, "forPathsOfEdges matched without any matching edges");
      }
    });
    // Delete edges
    this.graphOps.deleteEdges(oldTransfer);
    // Return new degree-2 node
    return newNode;
  }

  // Local complementation
  // The node must be Z- or X-type and have an angle of ±π/2
  // The node's neighbors must all be the same type and may only have Hadamard
  // edges between each other and the given node
  localComplementationIsValid(node) {
    try {
      this.localComplementation(node, true);
    } catch (e) {
      if (e instanceof GraphRewriteException) return false;
      throw e;
    }
    return true;
  }
  localComplementation(node, dryRun) {
    if (
      !(
        this.graphOps.isZOrXNode(node) &&
        this.graphOps.hasAnglePlusOrMinusPiDiv2(node)
      )
    ) {
      throw new GraphRewriteException(
        "node is not Z- or X-type or has a non ±π/2 angle"
      );
    }
    const type = this.graphOps.nodeType(node);
    const angle = this.graphOps.angle(node);
    const neighbors = [];
    const starEdges = [];
    // Find neighbors
    this.graphOps.forEdgesOfNodes([node], (edge) => {
      const [n1, n2] = this.graphOps.nodesOfEdge(edge);
      const neighbor = n1 === node ? n2 : n1;
      if (!this.graphOps.isHadamardEdge(edge)) {
        throw new GraphRewriteException("edge is not a Hadamard edge");
      }
      if (this.graphOps.nodeType(neighbor) !== type) {
        throw new GraphRewriteException(
          "node is neighbor to a different type node"
        );
      }
      neighbors.push(neighbor);
      starEdges.push(edge);
    });
    // Find existing edges to remove later
    const edgesToRemove = [];
    const oldNodePairs = new Set();
    this.graphOps.forInnerEdgesOfNodes(neighbors, (edge) => {
      const [n1, n2] = this.graphOps.nodesOfEdge(edge);
      if (!this.graphOps.isHadamardEdge(edge)) {
        throw new GraphRewriteException(
          "existing edge between neighbors is not a Hadamard edge"
        );
      }
      edgesToRemove.push(edge);
      const pair = this.graphOps.nodePairString(n1, n2);
      if (oldNodePairs.has(pair)) {
        throw new GraphRewriteException("multi-edge between neighbors");
      }
      oldNodePairs.add(pair);
    });
    if (dryRun) {
      return;
    }
    // Add edges
    const newEdgeMap = {};
    for (let i = 0; i < neighbors.length; i++) {
      const n1 = neighbors[i];
      for (let j = i + 1; j < neighbors.length; j++) {
        const n2 = neighbors[j];
        const pair = this.graphOps.nodePairString(n1, n2);
        if (!oldNodePairs.has(pair)) {
          newEdgeMap[pair] = this.graphOps.addHadamardEdge(n1, n2);
        }
      }
    }
    // Update any paths
    this.graphOps.forPathsOfEdges(starEdges, (pathId) => {
      const pathEdges = this.graphOps.pathEdges(pathId);
      const transferEdges = [];
      for (const e of starEdges) {
        if (pathEdges.indexOf(e) >= 0) {
          transferEdges.push(e);
        }
      }
      if (transferEdges.length === 2) {
        // Path goes from one neighbor, to the given node, then out
        const [e1, e2] = transferEdges;
        const [n1a, n1b] = this.graphOps.nodesOfEdge(e1);
        const n1 = n1a === node ? n1b : n1a;
        const [n2a, n2b] = this.graphOps.nodesOfEdge(e2);
        const n2 = n2a === node ? n2b : n2a;
        const subsEdge = newEdgeMap[this.graphOps.nodePairString(n1, n2)];
        if (!subsEdge) {
          // The intended edge already existed and will be removed
          // TODO: See if it is possible to maintain the path
          return; // Give up on this path
        }
        if (n1b === node) {
          // Forward path
          this.graphOps.substitutePathEdge(e1, [subsEdge], 0, 1);
        } else {
          // Reverse path
          this.graphOps.substitutePathEdge(e1, [subsEdge], 1, 0);
        }
      } else if (transferEdges.length > 0) {
        // Too many matched edges
        throw new GraphRewriteException("malformed path nearby");
      } else {
        assert(false, "forPathsOfEdges matched without any matching edges");
      }
    });
    // Update angles
    for (const n of neighbors) {
      this.graphOps.subtractAngle(n, angle);
    }
    // Delete node and edges
    this.graphOps.deleteEdges(edgesToRemove);
    this.graphOps.deleteNodes([node]); // Also removes starEdges
    return neighbors;
  }

  // Reverse local complementation
  // The nodes must all be Z- or X-type and may only have Hadamard edges between
  // each other
  revLocalComplementationIsValid(nodes, negative) {
    try {
      this.revLocalComplementation(nodes, negative, true);
    } catch (e) {
      if (e instanceof GraphRewriteException) return false;
      throw e;
    }
    return true;
  }
  revLocalComplementation(nodes, negative, dryRun) {
    // Check node types
    let nodeType;
    if (nodes.length <= 0) {
      nodeType = "z";
    } else {
      if (!this.graphOps.isZOrXNode(nodes[0])) {
        throw new GraphRewriteException("node is not Z- or X-type");
      }
      nodeType = this.graphOps.nodeType(nodes[0]);
    }
    for (const n of nodes) {
      if (this.graphOps.nodeType(n) !== nodeType) {
        throw new GraphRewriteException("nodes have mismatched types");
      }
    }
    // Find existing edges to remove later
    const edgesToRemove = [];
    const oldNodePairs = new Set();
    this.graphOps.forInnerEdgesOfNodes(nodes, (edge) => {
      const [n1, n2] = this.graphOps.nodesOfEdge(edge);
      if (!this.graphOps.isHadamardEdge(edge)) {
        throw new GraphRewriteException("existing edge is not a Hadamard edge");
      }
      edgesToRemove.push(edge);
      const pair = this.graphOps.nodePairString(n1, n2);
      if (oldNodePairs.has(pair)) {
        throw new GraphRewriteException("multi-edge between neighbors");
      }
      oldNodePairs.add(pair);
    });
    if (dryRun) {
      return;
    }
    // Add edges
    const newEdgeMap = {};
    for (let i = 0; i < nodes.length; i++) {
      const n1 = nodes[i];
      for (let j = i + 1; j < nodes.length; j++) {
        const n2 = nodes[j];
        const pair = this.graphOps.nodePairString(n1, n2);
        if (!oldNodePairs.has(pair)) {
          newEdgeMap[pair] = this.graphOps.addHadamardEdge(n1, n2);
        }
      }
    }
    // Adjust angles
    let xSum = 0;
    let ySum = 0;
    const angle = negative ? ANGLE_PI_DIVN2 : ANGLE_PI_DIV2;
    for (const n of nodes) {
      this.graphOps.addAngle(n, angle);
      xSum += this.graphOps.locationX(n);
      ySum += this.graphOps.locationY(n);
    }
    // Add new node
    if (nodes.length === 1) {
      xSum += 24;
      ySum -= 24;
    }
    const centerNode = this.graphOps.addNode(
      nodeType,
      xSum / nodes.length,
      ySum / nodes.length,
      angle
    );
    // Add star edges
    for (const n of nodes) {
      this.graphOps.addHadamardEdge(centerNode, n);
    }
    // Remove old edges
    this.graphOps.deleteEdges(edgesToRemove);
    return centerNode;
  }

  // Pivot
  // The two nodes and their neighbors must all be the same Z- or X-type
  // and may only have Hadamard edges between each other
  pivotIsValid(edge) {
    try {
      this.pivot(edge, true);
    } catch (e) {
      if (e instanceof GraphRewriteException) return false;
      throw e;
    }
    return true;
  }
  pivot(pivotEdge, dryRun) {
    if (!this.graphOps.isHadamardEdge(pivotEdge)) {
      throw new GraphRewriteException("pivot edge is not a Hadamard edge");
    }
    const [pivotA, pivotB] = this.graphOps.nodesOfEdge(pivotEdge);
    const aIsPi = this.graphOps.hasAnglePi(pivotA);
    const bIsPi = this.graphOps.hasAnglePi(pivotB);
    // Check same node types
    const type = this.graphOps.nodeType(pivotA);
    if (!this.graphOps.isZOrXNode(pivotA)) {
      throw new GraphRewriteException("pivot node is not Z- or X-type");
    }
    if (this.graphOps.nodeType(pivotB) !== type) {
      throw new GraphRewriteException("pivot nodes have mismatched types");
    }
    if (
      !this.graphOps.hasAngleZeroOrPi(pivotA) ||
      !this.graphOps.hasAngleZeroOrPi(pivotB)
    ) {
      throw new GraphRewriteException(
        "pivot node angle is not a muptiple of pi"
      );
    }
    // Find neighbors
    const allNeighborsA = [];
    const allNeighborsB = [];
    const starEdges = [];
    this.graphOps.forEdgesOfNodes([pivotA, pivotB], (edge) => {
      if (edge === pivotEdge) {
        return; // Skip the edge between the pivot nodes
      }
      const [n1, n2] = this.graphOps.nodesOfEdge(edge);
      const onA = n1 === pivotA || n2 === pivotA;
      const neighbor = n1 === pivotA || n1 === pivotB ? n2 : n1;
      if (!this.graphOps.isHadamardEdge(edge)) {
        throw new GraphRewriteException("edge is not a Hadamard edge");
      }
      if (this.graphOps.nodeType(neighbor) !== type) {
        throw new GraphRewriteException(
          "pivot node is neighbor to a different type node"
        );
      }
      (onA ? allNeighborsA : allNeighborsB).push(neighbor);
      starEdges.push(edge);
    });
    const setB = new Set(allNeighborsB);
    const neighborsAB = allNeighborsA.filter((n) => setB.has(n)); // Intersect
    const setAB = new Set(neighborsAB);
    const neighborsA = allNeighborsA.filter((n) => !setAB.has(n));
    const neighborsB = allNeighborsB.filter((n) => !setAB.has(n));
    // Find existing edges to remove later
    const edgesToRemove = [];
    const oldNodePairs = new Set();
    for (const [group1, group2] of [
      [neighborsA, neighborsB],
      [neighborsA, neighborsAB],
      [neighborsB, neighborsAB],
    ]) {
      this.graphOps.forCrossingEdgesOfNodes(group1, group2, (edge) => {
        const [n1, n2] = this.graphOps.nodesOfEdge(edge);
        if (!this.graphOps.isHadamardEdge(edge)) {
          throw new GraphRewriteException(
            "existing edge between neighbor groups is not a Hadamard edge"
          );
        }
        edgesToRemove.push(edge);
        const pair = this.graphOps.nodePairString(n1, n2);
        if (oldNodePairs.has(pair)) {
          throw new GraphRewriteException("multi-edge between pivot groups");
        }
        oldNodePairs.add(pair);
      });
    }
    if (dryRun) {
      return;
    }
    // Add edges
    for (const [group1, group2] of [
      [neighborsA, neighborsB],
      [neighborsA, neighborsAB],
      [neighborsB, neighborsAB],
    ]) {
      for (const n1 of group1) {
        for (const n2 of group2) {
          const pair = this.graphOps.nodePairString(n1, n2);
          if (!oldNodePairs.has(pair)) {
            this.graphOps.addHadamardEdge(n1, n2);
          }
        }
      }
    }
    // TODO: Update any paths
    // Update angles
    if (bIsPi) {
      for (const n of neighborsA) {
        this.graphOps.addAngle(n, ANGLE_PI);
      }
    }
    if (aIsPi) {
      for (const n of neighborsB) {
        this.graphOps.addAngle(n, ANGLE_PI);
      }
    }
    if (aIsPi ^ bIsPi ^ 1) {
      for (const n of neighborsAB) {
        this.graphOps.addAngle(n, ANGLE_PI);
      }
    }
    // Delete two pivot nodes and edges
    this.graphOps.deleteEdges(edgesToRemove);
    this.graphOps.deleteNodes([pivotA, pivotB]); // Also removes starEdges
    return [...neighborsA, ...neighborsB, ...neighborsAB];
  }

  // Reverse Pivot (2 steps)
  // Step 1:
  // The two nodes and their neighbors must all be the same Z- or X-type
  // and may only have Hadamard edges between each other
  revPivotStep1IsValid(nodes, addPi) {
    try {
      this.revPivotStep1(nodes, addPi, true);
    } catch (e) {
      if (e instanceof GraphRewriteException) return false;
      throw e;
    }
    return true;
  }
  revPivotStep1(nodes, addPi, dryRun) {
    // Check node types
    let nodeType;
    if (nodes.length <= 0) {
      nodeType = "z";
    } else {
      if (!this.graphOps.isZOrXNode(nodes[0])) {
        throw new GraphRewriteException("node is not Z- or X-type");
      }
      nodeType = this.graphOps.nodeType(nodes[0]);
    }
    let xSum = 0;
    let ySum = 0;
    for (const n of nodes) {
      if (this.graphOps.nodeType(n) !== nodeType) {
        throw new GraphRewriteException("nodes have mismatched types");
      }
      xSum += this.graphOps.locationX(n);
      ySum += this.graphOps.locationY(n);
    }
    if (dryRun) {
      return;
    }
    // Add temporary pivot node and edges
    if (nodes.length === 1) {
      xSum += 24;
      ySum -= 24;
    }
    const pivotNode = this.graphOps.addNode(
      "pivotA",
      xSum / nodes.length,
      ySum / nodes.length,
      addPi ? ANGLE_PI : ANGLE_ZERO
    );
    // Add star edges
    for (const n of nodes) {
      this.graphOps.addHadamardEdge(pivotNode, n);
    }
    return pivotNode;
  }

  // Reverse Pivot (2 steps)
  // Step 2:
  // The two nodes and their neighbors must all be the same Z- or X-type
  // and may only have Hadamard edges between each other
  revPivotStep2IsValid(nodes, addPi, xB, yB) {
    try {
      this.revPivotStep2(nodes, addPi, xB, yB, true);
    } catch (e) {
      if (e instanceof GraphRewriteException) return false;
      throw e;
    }
    return true;
  }
  revPivotStep2(nodes, addPi, xB, yB, dryRun) {
    if (
      nodes.length === 2 &&
      this.graphOps.nodeType(nodes[0]) === "pivotA" &&
      this.graphOps.nodeType(nodes[1]) === "pivotA"
    ) {
      // Special use case when two temporary pivot nodes are given
      if (addPi) {
        throw new GraphRewriteException("cannot set pi on existing pivots");
      }
      if (!this.graphOps.hasAngleZeroOrPi(nodes[1])) {
        throw new GraphRewriteException(
          "temporary pivot node angle is not a multiple of pi"
        );
      }
      const newAddPi = this.graphOps.hasAnglePi(nodes[1]);
      // Find set B nodes
      const newArgNodes = [nodes[0]];
      this.graphOps.forEdgesOfNodes([nodes[1]], (edge) => {
        const [n1, n2] = this.graphOps.nodesOfEdge(edge);
        const neighbor = n1 === nodes[1] ? n2 : n1;
        newArgNodes.push(neighbor);
      });
      // Run reverse pivot
      const ret = this.revPivotStep2(
        newArgNodes,
        newAddPi,
        this.graphOps.locationX(nodes[1]),
        this.graphOps.locationY(nodes[1]),
        dryRun
      );
      if (!dryRun) {
        this.graphOps.deleteNodes([nodes[1]]);
      }
      return ret;
    }
    // Normal use case when a single temporary pivot and set B nodes are given
    // Separate pivot and B nodes
    let pivotA;
    const nodesB = [];
    for (const n of nodes) {
      if (this.graphOps.nodeType(n) === "pivotA") {
        if (pivotA) {
          throw new GraphRewriteException("too many temporary pivot nodes");
        }
        pivotA = n;
      } else {
        nodesB.push(n);
      }
    }
    if (!pivotA) {
      throw new GraphRewriteException("no temporary pivot node given");
    }
    if (!this.graphOps.hasAngleZeroOrPi(pivotA)) {
      throw new GraphRewriteException(
        "temporary pivot node angle is not a multiple of pi"
      );
    }
    const piA = this.graphOps.hasAnglePi(pivotA);
    // Find set A nodes
    const nodesA = [];
    this.graphOps.forEdgesOfNodes([pivotA], (edge) => {
      const [n1, n2] = this.graphOps.nodesOfEdge(edge);
      const neighbor = n1 === pivotA ? n2 : n1;
      nodesA.push(neighbor);
    });
    // Run reverse pivot
    const ret = this.revPivot(
      nodesA,
      nodesB,
      piA,
      addPi,
      this.graphOps.locationX(pivotA),
      this.graphOps.locationY(pivotA),
      xB,
      yB,
      dryRun
    );
    if (!dryRun) {
      this.graphOps.deleteNodes([pivotA]);
    }
    return ret;
  }
  revPivot(allNodesA, allNodesB, piA, piB, xA, yA, xB, yB, dryRun) {
    // Get node sets
    const setAllA = new Set(allNodesA);
    const setAllB = new Set(allNodesB);
    const nodesA = allNodesA.filter((n) => !setAllB.has(n));
    const nodesB = allNodesB.filter((n) => !setAllA.has(n));
    const nodesAB = allNodesA.filter((n) => setAllB.has(n));
    const allNodes = [...allNodesA, ...nodesB];
    // Check node types
    let nodeType;
    if (allNodes.length <= 0) {
      nodeType = "z";
    } else {
      if (!this.graphOps.isZOrXNode(allNodes[0])) {
        throw new GraphRewriteException("node is not Z- or X-type");
      }
      nodeType = this.graphOps.nodeType(allNodes[0]);
    }
    for (const n of allNodes) {
      if (this.graphOps.nodeType(n) !== nodeType) {
        throw new GraphRewriteException("nodes have mismatched types");
      }
    }
    // Find existing edges to remove later
    const edgesToRemove = [];
    const oldNodePairs = new Set();
    for (const [group1, group2] of [
      [nodesA, nodesB],
      [nodesA, nodesAB],
      [nodesB, nodesAB],
    ]) {
      this.graphOps.forCrossingEdgesOfNodes(group1, group2, (edge) => {
        const [n1, n2] = this.graphOps.nodesOfEdge(edge);
        if (!this.graphOps.isHadamardEdge(edge)) {
          throw new GraphRewriteException(
            "existing edge between neighbor groups is not a Hadamard edge"
          );
        }
        edgesToRemove.push(edge);
        const pair = this.graphOps.nodePairString(n1, n2);
        if (oldNodePairs.has(pair)) {
          throw new GraphRewriteException("multi-edge between pivot groups");
        }
        oldNodePairs.add(pair);
      });
    }
    if (dryRun) {
      return;
    }
    // Calculate pivot positions
    let xSumA = 0;
    let ySumA = 0;
    let xSumB = 0;
    let ySumB = 0;
    if (xA === undefined || yA === undefined) {
      for (const n of allNodesA) {
        xSumA += this.graphOps.locationX(n);
        ySumA += this.graphOps.locationY(n);
      }
    }
    if (xB === undefined || yB === undefined) {
      for (const n of allNodesB) {
        xSumB += this.graphOps.locationX(n);
        ySumB += this.graphOps.locationY(n);
      }
    }
    if (allNodesA.length === 1) {
      xSumA += 24;
      ySumA -= 24;
    }
    if (allNodesB.length === 1) {
      xSumB += 24;
      ySumB -= 24;
    }
    if (xA === undefined) xA = xSumA / (allNodesA.length || 1);
    if (yA === undefined) yA = ySumA / (allNodesA.length || 1);
    if (xB === undefined) {
      xB = allNodesB.length ? xSumB / allNodesB.length : xA + 24;
    }
    if (yB === undefined) {
      yB = allNodesB.length ? ySumB / allNodesB.length : yA - 24;
    }
    // Add two pivot nodes and star edges
    const angleA = piA ? ANGLE_PI : ANGLE_ZERO;
    const angleB = piB ? ANGLE_PI : ANGLE_ZERO;
    const pivotA = this.graphOps.addNode(nodeType, xA, yA, angleA);
    const pivotB = this.graphOps.addNode(nodeType, xB, yB, angleB);
    console.log(xA, yA, xB, yB);
    for (const n of allNodesA) {
      this.graphOps.addHadamardEdge(pivotA, n);
    }
    for (const n of allNodesB) {
      this.graphOps.addHadamardEdge(pivotB, n);
    }
    const pivotEdge = this.graphOps.addHadamardEdge(pivotA, pivotB);
    // Add crossing edges
    for (const [group1, group2] of [
      [nodesA, nodesB],
      [nodesA, nodesAB],
      [nodesB, nodesAB],
    ]) {
      for (const n1 of group1) {
        for (const n2 of group2) {
          const pair = this.graphOps.nodePairString(n1, n2);
          if (!oldNodePairs.has(pair)) {
            this.graphOps.addHadamardEdge(n1, n2);
          }
        }
      }
    }
    // TODO: Update any paths
    // Update angles
    if (piB) {
      for (const n of nodesA) {
        this.graphOps.addAngle(n, ANGLE_PI);
      }
    }
    if (piA) {
      for (const n of nodesB) {
        this.graphOps.addAngle(n, ANGLE_PI);
      }
    }
    if (piA ^ piB ^ 1) {
      for (const n of nodesAB) {
        this.graphOps.addAngle(n, ANGLE_PI);
      }
    }
    // Delete two pivot nodes and edges
    this.graphOps.deleteEdges(edgesToRemove);
    return pivotEdge;
  }
}
