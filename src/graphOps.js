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

// Graph operations
export const addZNode = () => {
  const nodeId = `node${nextNodeIndex.value}`;
  const name = `N${nextNodeIndex.value}`;
  graphStore.nodes[nodeId] = {
    name: name,
    zxType: "z",
  };
  graphStore.nodes = Object.assign(graphStore.nodes, {});
  nextNodeIndex.value += 1;
};
