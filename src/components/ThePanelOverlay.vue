<script setup>
import { ref, defineProps } from "vue";
import { ElButton } from "element-plus";
import { configs } from "../graphStyle.js";

const show = ref(true);

</script>

<template>
  <div class="grid-container">

    <!-- Show panel button -->
    <Transition name="panel-fade">
      <div class="panelx show-btn" v-show="!show">
        <ElButton @click="show = !show" style="width: 7ch">Show</ElButton>
      </div>
    </Transition>

    <!-- Top panel -->
    <Transition name="panel-top">
      <div class="panelx panel1" v-show="show">
        <ElButton @click="show = !show" style="width: 7ch">Hide</ElButton>
      </div>
    </Transition>

    <!-- Left panel -->
    <Transition name="panel-left">
      <div class="panely panel2" v-show="show">Two</div>
    </Transition>

    <!-- Right Panel -->
    <Transition name="panel-right">
      <div class="panely panel3" v-show="show">
        Three
      </div>
    </Transition>

    <!-- Bottom Panel -->
    <Transition name="panel-bottom">
      <div class="panelx panel4" v-show="show">Four</div>
    </Transition>

  </div>
</template>

<style scoped>
.grid-container {
  --left-width: 180px;
  --right-width: 180px;
  --top-height: 50px;
  --bottom-height: 30px;
}

/* Panel grid and placement */
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
.panelx,
.panely {
  opacity: 0.95;
  pointer-events: auto;
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);
  padding: 5px 10px;
}

/* Show button */
.show-btn {
  grid-column: left;
  grid-row: top;
  pointer-events: none;
  background: none;
  box-shadow: none;
}
.show-btn > * {
  pointer-events: auto;
}

/* Panel transitions */
.panel-top-enter-active,
.panel-bottom-enter-active,
.panel-left-enter-active,
.panel-right-enter-active,
.panel-fade-enter-active {
  transition: transform 0.3s ease-out;
}
.panel-top-leave-active,
.panel-bottom-leave-active,
.panel-left-leave-active,
.panel-right-leave-active,
.panel-fade-leave-active {
  transition: transform 0.3s ease-out;
}
.panel-top-enter-from,
.panel-top-leave-to {
  transform: translateY(calc(-1 * var(--top-height) - 20px));
}
.panel-bottom-enter-from,
.panel-bottom-leave-to {
  transform: translateY(calc(1 * var(--bottom-height) + 20px));
}
.panel-left-enter-from,
.panel-left-leave-to {
  transform: translateX(calc(-1 * var(--left-width) - 20px));
}
.panel-right-enter-from,
.panel-right-leave-to {
  transform: translateX(calc(1 * var(--right-width) + 20px));
}
.panel-fade-enter-from,
.panel-fade-leave-to {
}

/* Panel content */
.panelx {
  overflow: hidden;
  overflow-x: scroll;
  display: flex;
  justify-content: left;
  align-items: center;
}
.panely {
  overflow: scroll;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: left;
  align-items: left;
}
.panely > * {
  margin-left: 0;
  margin-right: 0;
}
</style>
