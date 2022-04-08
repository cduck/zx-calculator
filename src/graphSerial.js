import { cleanInputStr } from "@/angles.js";

const VALID_NODE_ZX_TYPE = {
  boundary: "b",
  z: "z",
  x: "x",
  pivotA: "p",
};
const REV_NODE_ZX_TYPE = Object.fromEntries(
  Object.entries(VALID_NODE_ZX_TYPE).map(([k, v]) => [v, k])
);

const VALID_EDGE_ZX_TYPE = {
  normal: "n",
  hadamard: "h",
};
const REV_EDGE_ZX_TYPE = Object.fromEntries(
  Object.entries(VALID_EDGE_ZX_TYPE).map(([k, v]) => [v, k])
);

export function GraphSerializeException(msg) {
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

export const serialize = (data) => {
  const cleanWholeNumber = (v) => {
    const r = Math.floor(Number(v ?? 0) + 0.5);
    const s = r.toFixed(0);
    if (!s.match(/^-?[0-9]+$/)) return 0; // Number was probably huge
    return r;
  };
  const oneAsEmpty = (v) => (v === 1 ? "" : v);
  const nodeEntries = Object.entries(data.nodes);
  if (nodeEntries.length <= 0) {
    return "";
  }
  let minX = Infinity;
  let minY = Infinity;
  const scaleX = 1;
  const scaleY = 1;
  const defaultLoc = { x: 0, y: 0 };
  // Organize nodes by type and angle
  const nodesByTypeThenAngle = {};
  for (const [n, p] of nodeEntries) {
    const byAngle = nodesByTypeThenAngle[p.zxType] ?? {};
    nodesByTypeThenAngle[p.zxType] = byAngle;
    const a = p.zxAngle === "0" ? "" : p.zxAngle || "";
    const thisAngle = byAngle[a || ""] ?? {};
    byAngle[a] = thisAngle;
    const origLoc = data.layouts.nodes[n] ?? defaultLoc;
    thisAngle[n] = {
      x: cleanWholeNumber(origLoc.x * scaleX),
      y: cleanWholeNumber(origLoc.y * scaleY),
    };
    minX = Math.min(minX, thisAngle[n].x);
    minY = Math.min(minY, thisAngle[n].y);
  }
  assert(isFinite(minX) && isFinite(minY), "not finite minimums");
  // Serialize node layout args
  const nodeLayoutArgs = [
    minX || "",
    minY || "",
    oneAsEmpty(scaleX),
    oneAsEmpty(scaleY),
  ];
  while (nodeLayoutArgs[nodeLayoutArgs.length - 1] === "") {
    nodeLayoutArgs.pop();
  }
  const nodeLayoutStr = nodeLayoutArgs.join(",");
  // Serialize nodes
  const nodeIMap = {};
  let nodeI = 0;
  const nodesStrArr = [];
  let prevNodeType = "z";
  for (const zxType of Object.keys(nodesByTypeThenAngle).sort()) {
    const zxAbbr = VALID_NODE_ZX_TYPE[zxType];
    assert(
      zxAbbr && typeof zxAbbr === "string" && zxAbbr.length === 1,
      `invalid zxType "${zxType}"`
    );
    const byAngle = nodesByTypeThenAngle[zxType];
    byAngle[""] = byAngle[""] ?? {}; // Always include the zero angle group
    const sortedAngles = Object.keys(byAngle).sort();
    assert(sortedAngles[0] === "", "sort failure (${sortedAngles})");
    for (const angle of sortedAngles) {
      assert(
        angle.search(/[:;,]/) < 0,
        `angle has invalid characters "${angle}"`
      );
      if (angle === "") {
        if (zxAbbr !== prevNodeType) {
          nodesStrArr.push(zxAbbr);
          prevNodeType = zxAbbr;
        }
      } else {
        nodesStrArr.push(`@${angle}`);
      }
      const sortedNodes = Object.entries(byAngle[angle]).sort(
        ([n1, { x: x1, y: y1 }], [n2, { x: x2, y: y2 }]) =>
          y1 - y2 || x1 - x2 || n1.localCompare(n2, "en")
      );
      let prevX = minX;
      let prevY = minY;
      for (const [n, { x, y }] of sortedNodes) {
        let dx = cleanWholeNumber(x - prevX);
        let dy = cleanWholeNumber(y - prevY);
        prevX += dx;
        prevY += dy;
        if (dx < 0) {
          dx = cleanWholeNumber(x - minX);
          assert(dx >= 0, "min x was not min");
          prevX = minX + dx;
          dx = `+${dx || ""}`; // Plus indicates offset from min
        }
        if (dy < 0) {
          dy = cleanWholeNumber(y - minY);
          assert(dy >= 0, "min y was not min");
          prevY = minY + dy;
          dy = `+${dy || ""}`; // Plus indicates offset from min
        }
        nodesStrArr.push(dx || "", dy || "");
        nodeIMap[n] = nodeI;
        nodeI += 1;
      }
    }
  }
  const nodesStr = nodesStrArr.join(",");
  // Organize edges
  const edges = {};
  for (const [e, p] of Object.entries(data.edges)) {
    let zxAbbr = VALID_EDGE_ZX_TYPE[p.zxType];
    assert(
      zxAbbr && typeof zxAbbr === "string" && zxAbbr.length === 1,
      `invalid zxType "${p.zxType}"`
    );
    if (zxAbbr === "n") zxAbbr = ""; // Default is "n"
    edges[e] = [
      zxAbbr,
      ...[nodeIMap[p.source], nodeIMap[p.target]].sort((i1, i2) => i1 - i2),
    ];
  }
  const sortedEdges = Object.entries(edges).sort(
    ([e1, [t1, a1, b1]], [e2, [t2, a2, b2]]) =>
      a1 - a2 || b1 - b2 || t1.localCompare(t2, "en") || e1.localCompare(e2)
  );
  // Serialize edges
  const edgeIMap = {};
  let edgeI = 0;
  let prevType = "";
  let prevSource = -1;
  let prevTarget = -1;
  const edgesStrArr = [];
  let chainArr = []; // Sequence of nodes with edges with the same source+type
  for (const [e, [t, a, b]] of sortedEdges) {
    if (t !== prevType) {
      prevSource = -1;
      prevTarget = -1;
    }
    if (t !== prevType || a !== prevSource) {
      if (chainArr.length > 1) {
        edgesStrArr.push(chainArr.join("_"));
      }
      chainArr = [oneAsEmpty(a - prevSource)];
      prevSource = a;
      prevTarget = a;
    }
    if (t !== prevType) {
      edgesStrArr.push(t || "n");
      prevType = t;
    }
    chainArr.push(oneAsEmpty(b - prevTarget));
    prevTarget = b;

    edgeIMap[e] = edgeI;
    edgeI += 1;
  }
  if (chainArr.length > 1) {
    edgesStrArr.push(chainArr.join("_"));
  }
  const edgesStr = edgesStrArr.join(",");
  // Organize paths
  const paths = {};
  for (const [p, { edges: es }] of Object.entries(data.paths)) {
    paths[p] = [];
    for (const e of es) {
      paths[p].push(edgeIMap[e]);
    }
  }
  const sortedPaths = Object.entries(paths).sort(([p1, es1], [p2, es2]) => {
    for (let i = 0; i < es1.length && i < es2.length; i++) {
      if (es1[i] !== es2[i]) {
        return es1[i] - es2[i];
      }
    }
    if (es1.length != es2.length) return es1.length - es2.length;
    return (p1 > p2) - 0.5;
  });
  // Serialize paths
  const pathsStrArr = [];
  let prevI = -1;
  for (const [, es] of sortedPaths) {
    if (es.length <= 0) continue;
    const edgeDiffs = [
      es[0] < prevI ? `+${oneAsEmpty(es[0])}` : oneAsEmpty(es[0] - prevI),
    ];
    prevI = es[0];
    for (let i = 1; i < es.length; i++) {
      const op1 = `+${oneAsEmpty(es[i])}`;
      let op2 = `${oneAsEmpty(es[i] - prevI)}`;
      if (op2 === "-1") op2 = "-";
      const diff = op2.length > op1.length ? op1 : op2;
      edgeDiffs.push(diff);
      prevI = es[i];
    }
    pathsStrArr.push(edgeDiffs.join("="));
  }
  const pathsStr = pathsStrArr.join(",");
  // All in one string
  const graphStr = [nodeLayoutStr, nodesStr, edgesStr, pathsStr].join(";");
  const version = "0";
  const flags = "";
  if (version === "0" && !flags) {
    return graphStr;
  }
  return `${version}${flags}:${graphStr}`;
};

export const deserialize = (str) => {
  if (!str || typeof str !== "string" || str.length <= 0) {
    return undefined;
  }
  const mainComponents = str.split(":");
  if (mainComponents.length > 1 && mainComponents[0] !== "0") {
    throw GraphSerializeException(
      `Unknown version "${mainComponents[0].slice(0, 10)}"`
    );
  }
  // Parsing version "0"
  const [argsStr, nodeStr, edgeStr, pathStr] =
    mainComponents[mainComponents.length - 1].split(";");
  // Parse node layout args
  let [minX, minY, scaleX, scaleY] = argsStr.split(",").map(Number);
  minX = minX || 0;
  minY = minY || 0;
  scaleX = scaleX || 1;
  scaleY = scaleY || 1;
  // Parse nodes
  const nodes = {};
  const locations = {};
  let nodeI = 0;
  let nodeType = "z";
  let nodeAngle = "";
  let prevX = minX;
  let prevY = minY;
  let gotX = false;
  for (let entry of nodeStr.split(",")) {
    if (entry === "" || entry === "+" || entry === "-") entry = entry + "0";
    const num = Number(entry);
    if (!isFinite(num)) {
      if (entry.slice(0, 1) === "@") {
        // Parse new angle
        nodeAngle = entry.slice(1);
        try {
          nodeAngle = cleanInputStr(nodeAngle);
        } catch (e) {
          console.warn(`cannot parse angle "${nodeAngle}"`, e);
          nodeAngle = "?";
        }
      } else {
        // Parse zxType flag
        const typeAbbr = entry;
        if (
          Object.prototype.hasOwnProperty.call(REV_NODE_ZX_TYPE, typeAbbr) &&
          REV_NODE_ZX_TYPE[typeAbbr]
        ) {
          nodeType = REV_NODE_ZX_TYPE[typeAbbr];
        } else {
          console.warn(`unknown node type flag "${entry}"`);
          nodeType = "unknown";
        }
        nodeAngle = ""; // Reset angle on new zxType
      }
      prevX = minX; // Reset position on any flag
      prevY = minY;
    } else if (nodeType) {
      // Parse X or Y location
      const isPlus = entry.slice(0, 1) === "+";
      if (gotX) {
        prevY = isPlus ? minY + num : prevY + num;
        const nid = `n${nodeI}`;
        nodes[nid] = { zxType: nodeType };
        if (nodeAngle) nodes[nid].zxAngle = nodeAngle;
        locations[nid] = { x: prevX / scaleX, y: prevY / scaleY };
        gotX = false;
        nodeI += 1;
      } else {
        prevX = isPlus ? minX + num : prevX + num;
        gotX = true;
      }
    }
  }
  // Parse edges
  const edges = {};
  let edgeI = 0;
  let edgeType = "normal";
  let prevSource = -1;
  for (const group of edgeStr.split(",")) {
    if (group.length > 0 && group.indexOf("_") < 0) {
      // Parse type flag
      const typeAbbr = group;
      if (
        Object.prototype.hasOwnProperty.call(REV_EDGE_ZX_TYPE, typeAbbr) &&
        REV_EDGE_ZX_TYPE[typeAbbr]
      ) {
        edgeType = REV_EDGE_ZX_TYPE[typeAbbr];
      } else {
        console.warn(`unknown edge type flag "${group}"`);
        edgeType = "unknown";
      }
      prevSource = -1;
    } else if (edgeType) {
      // Parse edge group
      let prevTarget;
      let first = true;
      for (let entry of group.split("_")) {
        if (entry === "") entry = "1";
        const num = Number(entry);
        if (!isFinite(num) || num !== Math.floor(num)) {
          console.warn(`non-integer node id in edge "${entry}"`);
        } else {
          if (first) {
            first = false;
            prevSource += num;
            prevTarget = prevSource;
          } else {
            prevTarget += num;
            if (prevSource >= nodeI || prevTarget >= nodeI) {
              console.warn(`edge between non-existant nodes "${group}"`);
            } else {
              edges[`e${edgeI}`] = {
                source: `n${prevSource}`,
                target: `n${prevTarget}`,
                zxType: edgeType,
              };
              edgeI += 1;
            }
          }
        }
      }
    }
  }
  // Parse paths
  const paths = {};
  let pathI = 0;
  let prevEdge = -1;
  for (const group of pathStr.split(",")) {
    if (group.length > 0 && group.indexOf("=") < 0) {
      // No known flags to check, ignore
      console.warn(`unknown path flag "${group}"`);
      prevEdge = -1;
    } else {
      const edges = [];
      for (let entry of group.split("=")) {
        if (entry === "" || entry === "+" || entry === "-") entry = entry + "1";
        const isPlus = entry.slice(0, 1) === "+";
        const num = Number(entry);
        if (!isFinite(num) || num !== Math.floor(num)) {
          console.warn(`non-integer edge id in path "${entry}"`);
        } else {
          prevEdge = isPlus ? num : prevEdge + num;
          edges.push(`e${prevEdge}`);
        }
      }
      paths[`p${pathI}`] = { edges: edges };
      pathI += 1;
    }
  }
  // Make graph
  return {
    nodes: nodes,
    edges: edges,
    paths: paths,
    layouts: {
      nodes: locations,
    },
  };
};
