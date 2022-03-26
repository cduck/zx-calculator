import { defineStore } from "pinia";

// https://pinia.vuejs.org/introduction.html
export const usePanelStore = defineStore("graph", {
  state: () => ({
    nodes: {
      node1: { name: "Node 1", zxType: "boundary" },
      node2: { name: "Node 2", zxType: "z", zxAngle: "π/2" },
      node3: { name: "Node 3", zxType: "z" },
      node4: { name: "Node 4", zxType: "boundary" },
    },
    edges: {
      edge1: { source: "node1", target: "node2", zxType: "normal" },
      edge2: { source: "node2", target: "node3", zxType: "hadamard" },
      edge3: { source: "node3", target: "node4", zxType: "hadamard" },
    },
    paths: {
      path1: { edges: ["edge1", "edge2", "edge3"] },
    },
  }),
});
