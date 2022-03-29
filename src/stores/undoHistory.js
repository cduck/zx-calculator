import { defineStore } from "pinia";

// https://pinia.vuejs.org/introduction.html
export const useUndoStore = defineStore("undoHistory", {
  state: () => ({
    history: [],
    currentIndex: -1,
    maxHistory: 0,
  }),
  actions: {
    _trimToMaxLength() {
      if (this.maxHistory > 0 && this.history.length > this.maxHistory) {
        let cut = this.history.length - this.maxHistory;
        if (cut > this.currentIndex) {
          cut = this.currentIndex;
        }
        this.currentIndex -= cut;
        this.history.splice(0, cut);
      }
    },
    addEntry(dataCopy, name) {
      this.history.splice(this.currentIndex + 1); // Remove all redo entries
      this.history.push({ data: dataCopy, name: name });
      this.currentIndex = this.history.length - 1;
      this._trimToMaxLength();
    },
    updateEntry(dataCopy, name) {
      this.history[this.currentIndex] = { data: dataCopy, name: name };
    },
    insertEntry(dataCopy, name) {
      this.history.splice(this.currentIndex + 1, 0, {
        data: dataCopy,
        name: name,
      });
      this.currentIndex += 1;
    },
    undo() {
      if (this.currentIndex <= 0) {
        return undefined;
      }
      this.currentIndex -= 1;
      return this.history[this.currentIndex].data;
    },
    redo() {
      if (this.currentIndex >= this.history.length - 1) {
        return undefined;
      }
      this.currentIndex += 1;
      return this.history[this.currentIndex].data;
    },
    isTopOfHistory() {
      return this.currentIndex >= this.history.length - 1;
    },
    isBottomOfHistory() {
      return this.currentIndex <= 0;
    },
  },
});
