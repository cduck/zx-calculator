import { cleanInputStr } from "@/angles.js";

export function GraphImportException(msg) {
  this.message = msg;
}

const niceNumber = (v) => {
  if (typeof v !== "number") return 0;
  if (!isFinite(v)) return 0;
  return v;
};

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

// Parses a subset of the PyZX output JSON
export const fromPyzxJson = (str, scale) => {
  scale = scale ?? 1;
  // Parse JSON
  const pyzx = JSON.parse(str);
  //if (pyzx?.layouts?.nodes) {
  //  // This is native graph data, use as it without checking
  //  return pyzx;
  //}
  if (!(pyzx?.wire_vertices && pyzx?.node_vertices && pyzx?.undir_edges)) {
    throw new GraphImportException("JSON does not contain the expected keys");
  }
  // Load boundaries
  const nodes = {};
  const locations = {};
  for (const [node, params] of Object.entries(pyzx.wire_vertices ?? {})) {
    nodes[node] = {
      zxType: "boundary",
    };
    locations[node] = {
      x: niceNumber(params?.annotation?.coord?.[0]) * scale,
      y: -niceNumber(params?.annotation?.coord?.[1]) * scale,
    };
  }
  // Load other nodes (including Hadamard edge nodes)
  const pretendNodes = {};
  for (const [node, params] of Object.entries(pyzx.node_vertices ?? {})) {
    if (hasOwn(nodes, node) || hasOwn(pretendNodes, node)) {
      throw new GraphImportException(
        `multiple nodes have the same name key "${node}"`
      );
    }
    const pyzxType = `${params?.data?.type || ""}`.toLowerCase();
    if (params?.data?.is_edge) {
      // A Hadamard edge pretending to be a node
      let type;
      if (pyzxType === "hadamard") {
        type = "hadamard";
      } else {
        console.warn(
          `unknown or undefined edge type "${params?.annotation?.data?.type}"` +
            ` of "${node}"`
        );
        type = "unknown";
      }
      pretendNodes[node] = type;
    } else {
      // A real node
      let type;
      if (!(pyzxType === "z" || pyzxType === "x")) {
        console.warn(
          `unknown or undefined node type "${params?.annotation?.data?.type}"` +
            ` of "${node}"`
        );
        type = "unknown";
      } else {
        type = pyzxType;
      }
      const pyzxAngle = params?.data?.value;
      let angle;
      try {
        angle = pyzxAngle ? cleanInputStr(pyzxAngle) : "";
      } catch (e) {
        throw new GraphImportException(
          `invalid node angle "${pyzxAngle}": ${e.message || e}`
        );
      }
      nodes[node] = {
        zxType: type,
      };
      if (angle) {
        nodes[node].zxAngle = angle;
      }
      locations[node] = {
        x: niceNumber(params?.annotation?.coord?.[0]) * scale,
        y: -niceNumber(params?.annotation?.coord?.[1]) * scale,
      };
    }
  }
  // Load normal edges
  const edges = {};
  const pretendNodeNeighbors = {};
  for (const [edge, params] of Object.entries(pyzx.undir_edges)) {
    const src = params?.src;
    const tgt = params?.tgt;
    if (!(hasOwn(nodes, src) && hasOwn(nodes, tgt))) {
      // Handle edges to pretend nodes
      if (hasOwn(pretendNodes, src)) {
        pretendNodeNeighbors[src] = pretendNodeNeighbors[src] ?? [];
        pretendNodeNeighbors[src].push(tgt);
        if (hasOwn(pretendNodes, tgt)) {
          throw new GraphImportException("pretend node is acting like a node");
        }
      } else if (hasOwn(pretendNodes, tgt)) {
        pretendNodeNeighbors[tgt] = pretendNodeNeighbors[tgt] ?? [];
        pretendNodeNeighbors[tgt].push(src);
      } else {
        throw new GraphImportException(
          `edge references nonexistant node(s) "${src}", "${tgt}"`
        );
      }
    } else {
      const type = "normal";
      edges[edge] = {
        source: src,
        target: tgt,
        zxType: type,
      };
    }
  }
  // Now put in the pretend node edges
  for (const [pnode, neighbors] of Object.entries(pretendNodeNeighbors)) {
    if (neighbors.length !== 2) {
      throw new GraphImportException("pretend node is acting like a node (2)");
    }
    const [n1, n2] = neighbors.sort();
    const type = pretendNodes[pnode];
    edges[`e!${pnode}`] = {
      source: n1,
      target: n2,
      zxType: type,
    };
  }
  // Make graph
  return {
    nodes: nodes,
    edges: edges,
    paths: {}, // PyZX doesn't have paths
    layouts: {
      nodes: locations,
    },
  };
};

export const toPyzxJson = (graph, scale, prettyIndent) => {
  //return JSON.stringify(graph, null, 2);

  scale = scale ?? 1;

  // TODO: Sort nodes and edges for consistency

  let boundaryI = 0;
  let vertexI = 0;
  let edgeI = 0;
  const nodeIdMap = {};
  const edgeIdMap = {};
  const boundaries = {};
  const vertices = {};
  const edges = {};
  // Nodes
  for (const [n, p] of Object.entries(graph.nodes)) {
    const { x, y } = graph.layouts.nodes[n] ?? { x: 0, y: 0 };
    if (p.zxType === "boundary") {
      nodeIdMap[n] = `b${boundaryI}`;
      boundaryI += 1;
      boundaries[nodeIdMap[n]] = {
        annotation: {
          boundary: true,
          coord: [x / scale, -y / scale],
          input: false, // TODO: Resolve this disconnect in representation
          output: false,
        },
      };
    } else {
      nodeIdMap[n] = `v${vertexI}`;
      vertexI += 1;
      vertices[nodeIdMap[n]] = {
        annotation: {
          coord: [x / scale, -y / scale],
        },
        data: {
          type: p.zxType.length === 1 ? p.zxType.toUpperCase() : p.zxType,
        },
      };
      if (p.zxAngle) {
        vertices[nodeIdMap[n]].data.value = p.zxAngle.replaceAll("π", "\\pi");
      }
    }
  }
  // Edges including pretend nodes
  for (const [e, p] of Object.entries(graph.edges)) {
    if (p.zxType === "normal") {
      edgeIdMap[e] = `e${edgeI}`;
      edgeI += 1;
      edges[edgeIdMap[e]] = {
        src: nodeIdMap[p.source],
        tgt: nodeIdMap[p.target],
      };
    } else {
      // Pretend node edge
      const vid = (nodeIdMap[e] = `v${vertexI}`);
      vertexI += 1;
      const { x: x1, y: y1 } = graph.layouts.nodes[p.source];
      const { x: x2, y: y2 } = graph.layouts.nodes[p.target];
      vertices[vid] = {
        annotation: {
          coord: [(x1 + x2) / 2 / scale, -(y1 + y2) / 2 / scale],
        },
        data: {
          type: p.zxType, // TODO: When more than just Hadamard, add logic here
          is_edge: "true", // PyZX expects the string "true", not true
        },
      };
      for (const other of [p.source, p.target]) {
        edgeIdMap[e] = `e${edgeI}`;
        edgeI += 1;
        edges[edgeIdMap[e]] = {
          src: nodeIdMap[other],
          tgt: vid,
        };
      }
    }
  }
  // Whole data structure
  return JSON.stringify(
    {
      wire_vertices: boundaries,
      node_vertices: vertices,
      undir_edges: edges,
      // TODO: Is "scalar": "{\"power2\": 0, \"phase\": \"0\"}" needed?
    },
    null,
    prettyIndent
  );
};
