<script setup>
import { ref, defineProps } from "vue";

</script>

<template>
  <div class="grid-container">
    <div class="panelx panel1">One</div>
    <div class="panely panel2">Two</div>
    <div class="panely panel3">Three</div>
    <div class="panelx panel4">Four</div>
  </div>
</template>

<style scoped>
.grid-container {
  --left-width: 180px;
  --right-width: 180px;
  --top-height: 50px;
  --bottom-height: 30px;
}

.grid-container {
  display: grid;
  grid-template-columns: [left] var(--left-width) [leftmid] 1fr [rightmid] var(
      --right-width) [right];
  grid-template-rows: [top] var(--top-height) [topmid] 1fr [bottommid] var(
      --bottom-height) [bottom];
  gap: 10px;
  padding: 7px;
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
}
.panel1 {
  grid-column: left / right;
  grid-row: top;
}
.panel2 {
  grid-column: left / leftmid;
  grid-row: topmid / bottom;
}
.panel3 {
  grid-column: rightmid / right;
  grid-row: topmid / bottom;
}
.panel4 {
  grid-column: leftmid / rightmid;
  grid-row: bottommid / bottom;
}
.panelx {
  overflow: hidden;
  overflow-x: scroll;
}
.panely {
  overflow: scroll;
  overflow-x: hidden;
}
.panelx,
.panely {
  opacity: 0.9;
  pointer-events: auto;
  background-color: white;
  border-radius: 8px;
  filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.3));
  padding: 5px 10px;
}
</style>
