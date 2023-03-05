import { defineStore } from "pinia";

// https://pinia.vuejs.org/introduction.html
export const usePanelStore = defineStore("panel", {
  state: () => ({
    rewriteMode: false,
    angleToSet: "",
    angleToAdd: "",
    angleToSplit: "",
    inlineHelpVisible: false,
  }),
});
