import { defineStore } from "pinia";

// https://pinia.vuejs.org/introduction.html
export const usePanelStore = defineStore("panel", {
  state: () => ({
    rewriteMode: false,
    selectMode: "",
    angleToSet: "",
    angleToAdd: "",
  }),
});
