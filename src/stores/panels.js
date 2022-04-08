import { defineStore } from "pinia";

// https://pinia.vuejs.org/introduction.html
export const usePanelStore = defineStore("panel", {
  state: () => ({
    rewriteMode: false,
    selectMode: "",
    angleToSet: "",
    angleToAdd: "",
    angleToSplit: "",
    modalImport: {
      visible: false,
    },
    modalExport: {
      visible: false,
    },
  }),
});
