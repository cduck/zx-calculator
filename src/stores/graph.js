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
    nodes: reactive({}),
    edges: reactive({}),
    paths: reactive({}),
    layouts: {
      nodes: reactive({}),
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
      if (data) {
        const layoutNodes = {};
        for (const [n, pos] of Object.entries(data.layouts.nodes)) {
          layoutNodes[n] = { ...pos };
        }
        overwriteDict(this.nodes, data.nodes);
        overwriteDict(this.edges, data.edges);
        overwriteDict(this.paths, data.paths);
        overwriteDict(this.layouts.nodes, layoutNodes);
      } else {
        overwriteDict(this.nodes, {});
        overwriteDict(this.edges, {});
        overwriteDict(this.paths, {});
        overwriteDict(this.layouts.nodes, {});
      }
    },
  },
});
