<script setup>
import { ref } from "vue";
import {
  ElButton,
  ElSwitch,
  ElTooltip,
  ElRadioButton,
  ElInput,
} from "element-plus";
import { usePanelStore } from "@/stores/panels.js";
import { useStyleStore } from "@/stores/graphStyle.js";

const show = ref(true);

const panelStore = usePanelStore();
const styleStore = useStyleStore();

const emit = defineEmits(["command"]);
</script>

<template>
  <div class="grid-container">
    <!-- Show panel button -->
    <Transition name="panel-fade">
      <div class="panelx show-btn" v-show="!show">
        <div>
          <ElButton @click="show = !show" style="width: 7ch">Show</ElButton>
        </div>
      </div>
    </Transition>

    <!-- Top panel -->
    <Transition name="panel-top">
      <div class="panelx panel-top" v-show="show">
        <div>
          <ElButton @click="show = !show" style="width: 7ch">Hide</ElButton>
          <ElSwitch
            v-model="panelStore.rewriteMode"
            inactive-text="Edit"
            active-text="Rewrite"
            inactive-color="#eb0"
          />
        </div>
      </div>
    </Transition>

    <!-- Left panel (edit) -->
    <Transition name="panel-left">
      <div class="panely panel-left" v-show="show && !panelStore.rewriteMode">
        <div>
          Select nodes:
          <ElTooltip content="Toggle edges on selected nodes [E]">
            <ElButton class="btn" @click="emit('command', 'e')">Toggle Edges</ElButton>
          </ElTooltip>
          <ElTooltip content="Toggle edges on selected nodes [Shift+E]">
            <ElButton class="btn" @click="emit('command', 'E')">Clear Edges</ElButton>
          </ElTooltip>
          <ElInput v-model="panelStore.angleToSet" placeholder="Node angle (i.e. \pi)" />
          <ElTooltip content="Sets the angle parameter of selected nodes [A]">
            <ElButton class="btn" @click="emit('command', 'a')">Set Angle</ElButton>
          </ElTooltip>
          No selection:
          <ElTooltip content="Create a boundary node [B]">
            <ElButton class="btn" @click="emit('command', 'b')">New Boundary</ElButton>
          </ElTooltip>
          <ElTooltip content="Create a Z node [N]">
            <ElButton class="btn" @click="emit('command', 'n')">New Node</ElButton>
          </ElTooltip>
          Any selection:
          <ElTooltip content="Delete selected nodes or edges [X]">
            <ElButton class="btn" @click="emit('command', 'x')">Delete</ElButton>
          </ElTooltip>
          Sequential edges:
          <ElTooltip content="Define a path from input to output boundary [S]">
            <ElButton class="btn" @click="emit('command', 's')">Define Path</ElButton>
          </ElTooltip>
          <ElTooltip content="Remove all paths touching selected edges [Shift+S]">
            <ElButton class="btn" @click="emit('command', 'S')">Clear Path</ElButton>
          </ElTooltip>
        </div>
      </div>
    </Transition>

    <!-- Left panel (rewrite) -->
    <Transition name="panel-left">
      <div class="panely panel-left" v-show="show && panelStore.rewriteMode">
        <div>
          Select single edge:
          <ElTooltip content="Inserts two Hadamard edges by adding two Z nodes [Shift+H]">
            <ElButton class="btn" @click="emit('command', 'H')">Edge -&gt; 2 Nodes</ElButton>
          </ElTooltip>
          Select single node:
          <ElTooltip content="Removes a degree=2 node by merging its neighbors [H]">
            <ElButton class="btn" @click="emit('command', 'h')">Remove degree-2</ElButton>
          </ElTooltip>
          <ElTooltip content="Removes a ±π/2 node by toggling all edges between its neighbors and adding ∓π/2 [C]">
            <ElButton class="btn" @click="emit('command', 'c')">Complementation</ElButton>
          </ElTooltip>
          Select two nodes:
          <ElTooltip content="Removes two nodes with angles 0 or π by toggling certain edges between their neighbors [P]">
            <ElButton class="btn" @click="emit('command', 'p')">Pivot</ElButton>
          </ElTooltip>
          Select multiple nodes:
          <ElTooltip content="Adds a ±π/2 node connected to the selected nodes by toggling all edges and adding ±π/2 [Shift+C]">
            <ElButton class="btn" @click="emit('command', 'C')">Complementation</ElButton>
          </ElTooltip>
          Reverse pivot:
          <ElRadioGroup v-model="panelStore.selectMode">
            <ElRadioButton label="a">A</ElRadioButton>
            <ElRadioButton label="">Both</ElRadioButton>
            <ElRadioButton label="B">B</ElRadioButton>
          </ElRadioGroup>
          <ElTooltip content="Adds two nodes by toggling edges between three groups of selections (A, A+B, and B) [Shift+P]">
            <ElButton class="btn" @click="emit('command', 'P')">Pivot</ElButton>
          </ElTooltip>
        </div>
      </div>
    </Transition>

    <!-- Right Panel -->
    <Transition name="panel-right">
      <div class="panely panel-right" v-show="show">
        <div>
          View Settings:
          <ElSwitch
            v-model="styleStore.view.grid.visible"
            inactive-text=""
            active-text="Grid"
          />
          <ElSwitch
            v-model="styleStore.extra.snapTo"
            inactive-text=""
            active-text="Snap to grid"
          />
          <ElSwitch
            v-model="styleStore.view.scalingObjects"
            inactive-text=""
            active-text="Scale nodes"
          />
          <ElButton class="btn" @click="styleStore.extra.zoomLevel=1">Reset Zoom</ElButton>
        </div>
      </div>
    </Transition>

    <!-- Bottom Panel -->
    <Transition name="panel-bottom">
      <div class="panelx panel-bottom" v-show="show && false"><div></div></div>
    </Transition>
  </div>
</template>

<style scoped>
.grid-container {
  --left-width: 180px;
  --right-width: 180px;
  --top-height: 42px;
  --bottom-height: 42px;
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
.panel-top {
  grid-column: left / right;
  grid-row: top;
}
.panel-left {
  grid-column: left / leftmid;
  grid-row: topmid / bottom;
}
.panel-right {
  grid-column: rightmid / right;
  grid-row: topmid / bottom;
}
.panel-bottom {
  grid-column: leftmid / rightmid;
  grid-row: bottommid / bottom;
}
.panelx,
.panely {
  opacity: 0.95;
}
.panelx > div,
.panely > div {
  padding: 5px 10px;
  pointer-events: auto;
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: 8px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.3);
}
.panelx > div {
  width: 100%;
  height: 100%;
}
.panely > div {
  width: 100%;
  height: content;
  max-height: 100%;
  padding-bottom: 1.5em;
}

/* Show button */
.show-btn {
  grid-column: left;
  grid-row: top;
}
.show-btn > div {
  pointer-events: none;
  background: none;
  box-shadow: none;
}
.show-btn > div > * {
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
.panelx > div {
  overflow: hidden;
  overflow-x: scroll;
  display: flex;
  justify-content: left;
  align-items: center;
}
.panelx > div > * {
  margin-right: 16px;
}
.panely > div {
  overflow: scroll;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: left;
  align-items: left;
}
.panely > div > * {
  margin-left: 0;
  margin-right: 0;
}

/* Panel alignment */
.btn-row .btn {
  margin-left: 0;
  margin-right: 0;
  width: 3ch;
}
.sld {
  padding-left: 10px;
  padding-right: 10px;
}
</style>
