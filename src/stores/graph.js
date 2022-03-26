import { reactive } from "vue";
import { defineStore } from "pinia";

// https://pinia.vuejs.org/introduction.html
export const useGraphStore = defineStore("graph", {
  state: () => ({
    nodes: reactive({
      node1: { name: "Node 1", zxType: "boundary" },
      node2: { name: "Node 2", zxType: "z", zxAngle: "π/2" },
      node3: { name: "Node 3", zxType: "z" },
      node4: { name: "Node 3", zxType: "z" },
      node5: { name: "Node 4", zxType: "boundary" },
    }),
    edges: reactive({
      edge1: { source: "node1", target: "node2", zxType: "normal" },
      edge2: { source: "node2", target: "node3", zxType: "hadamard" },
      edge3: { source: "node3", target: "node4", zxType: "hadamard" },
      edge4: { source: "node3", target: "node5", zxType: "normal" },
    }),
    paths: reactive({
      path1: { edges: ["edge1", "edge2", "edge3"] },
    }),
    layouts: {
      nodes: reactive({
        node1: { x: 0, y: 0 },
        node2: { x: 50, y: 0 },
        node3: { x: 50, y: -50 },
        node4: { x: 100, y: -100 },
        node5: { x: 100, y: -50 },
      }),
    },
  }),
});
