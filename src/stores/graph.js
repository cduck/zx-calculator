import { reactive } from "vue";
import { defineStore } from "pinia";

const overwriteDict = (oldObj, newObj) => {
  const oldKeys = Object.keys(oldObj);
  Object.assign(oldObj, newObj);
  for (const k of oldKeys) {
    if (!(k in newObj)) {
      delete oldObj[k];
    }
  }
};

// https://pinia.vuejs.org/introduction.html
export const useGraphStore = defineStore("graph", {
  state: () => ({
    nodes: reactive({
      node1: { zxType: "boundary" },
      node2: { zxType: "z", zxAngle: "π/2" },
      node3: { zxType: "boundary" },
      node4: { zxType: "boundary" },
      node5: { zxType: "z" },
      node6: { zxType: "boundary" },
    }),
    edges: reactive({
      edge1: { source: "node1", target: "node2", zxType: "normal" },
      edge2: { source: "node2", target: "node3", zxType: "normal" },
      edge3: { source: "node4", target: "node5", zxType: "normal" },
      edge4: { source: "node5", target: "node6", zxType: "normal" },
      edge5: { source: "node2", target: "node5", zxType: "hadamard" },
    }),
    paths: reactive({
      path1: { edges: ["edge1", "edge2"] },
      path2: { edges: ["edge3", "edge4"] },
    }),
    layouts: {
      nodes: reactive({
        node1: { x: -50, y: 0 },
        node2: { x: 0, y: 0 },
        node3: { x: 50, y: 0 },
        node4: { x: -50, y: 50 },
        node5: { x: 0, y: 50 },
        node6: { x: 50, y: 50 },
      }),
    },
  }),
  actions: {
    _copyData(data) {
      const paths = {};
      for (const p of Object.keys(data.paths)) {
        paths[p] = { edges: [...data.paths[p].edges] };
      }
      const layoutNodes = {};
      for (const n of Object.keys(data.layouts.nodes)) {
        layoutNodes[n] = { ...data.layouts.nodes[n] };
      }
      return {
        nodes: { ...data.nodes },
        edges: { ...data.edges },
        paths: paths,
        layouts: { nodes: layoutNodes },
      };
    },
    fullCopy() {
      return this._copyData(this);
    },
    fullReplace(data) {
      const newData = this._copyData(data);
      overwriteDict(this.nodes, data.nodes);
      overwriteDict(this.edges, data.edges);
      overwriteDict(this.paths, data.paths);
      overwriteDict(this.layouts.nodes, newData.layouts.nodes);
    },
  },
});
