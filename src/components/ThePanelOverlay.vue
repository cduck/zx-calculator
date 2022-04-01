<script setup>
import { ref } from "vue";
import {
  ElButton,
  ElSwitch,
  ElTooltip,
  ElRadioButton,
  ElAutocomplete,
} from "element-plus";
import { EditPen, Plus } from "@element-plus/icons-vue";
import { usePanelStore } from "@/stores/panels.js";
import { useStyleStore } from "@/stores/graphStyle.js";
import { version, versionKind } from "@/version.js";
import * as angles from "@/angles.js";

const show = ref(true);

const panelStore = usePanelStore();
const styleStore = useStyleStore();

const angleSuggestions = (query, callback) => {
  callback(angles.DEFAULT_SUGGESTIONS);
};
// Change event isn't fired for ElAutocomplete
const changeSetAngle = () => {
  try {
    panelStore.angleToSet = angles.cleanInputStr(panelStore.angleToSet);
  } catch (e) {
    return;
  }
};
const clickSetAngle = () => {
  try {
    panelStore.angleToSet = angles.cleanInputStr(panelStore.angleToSet);
  } catch (e) {
    return;
  }
  emit("command", "a");
};
// Change event isn't fired for ElAutocomplete
const changeAddAngle = () => {
  try {
    panelStore.angleToAdd = angles.cleanInputStr(panelStore.angleToAdd);
  } catch (e) {
    return;
  }
};
const clickAddAngle = () => {
  try {
    panelStore.angleToAdd = angles.cleanInputStr(panelStore.angleToAdd);
  } catch (e) {
    return;
  }
  emit("command", "A");
};

const props = defineProps({
  checkCanDoCommand: Object,
});
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
          <ElButton class="btn" style="width: 7ch" @click="show = !show">
            Hide
          </ElButton>
          <ElSwitch
            v-model="panelStore.rewriteMode"
            inactive-text="Edit"
            active-text="Rewrite"
            inactive-color="#eb0"
          />
          <div class="btn-row-group">
            <ElButton
              class="btn"
              @click="emit('command', 'Undo')"
              :disabled="!props.checkCanDoCommand.Undo.value"
            >
              Undo
            </ElButton>
            <ElButton
              class="btn"
              @click="emit('command', 'Redo')"
              :disabled="!props.checkCanDoCommand.Redo.value"
            >
              Redo
            </ElButton>
          </div>
          <div class="panel-top-right">
            <div class="version" :innerText="`${version} ${versionKind}`"></div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Left panel (edit) -->
    <Transition name="panel-left">
      <div class="panely panel-left" v-show="show && !panelStore.rewriteMode">
        <div>
          <ElButton
            class="btn"
            @click="emit('command', 'clear')"
            :disabled="!props.checkCanDoCommand.clear.value"
          >
            Clear Graph
          </ElButton>
          No selection:
          <ElTooltip content="Create a boundary node [B]">
            <ElButton
              class="btn"
              @click="emit('command', 'b')"
              :disabled="!props.checkCanDoCommand.b.value"
            >
              New Boundary
            </ElButton>
          </ElTooltip>
          <ElTooltip content="Create a Z node [N]">
            <ElButton
              class="btn"
              @click="emit('command', 'n')"
              :disabled="!props.checkCanDoCommand.n.value"
            >
              New Node
            </ElButton>
          </ElTooltip>
          Select nodes:
          <ElTooltip content="Toggle edges on selected nodes [E]">
            <ElButton
              class="btn"
              @click="emit('command', 'e')"
              :disabled="!props.checkCanDoCommand.e.value"
            >
              Toggle Edges
            </ElButton>
          </ElTooltip>
          <ElTooltip content="Clear edges on selected nodes [Shift+E]">
            <ElButton
              class="btn"
              @click="emit('command', 'E')"
              :disabled="!props.checkCanDoCommand.E.value"
            >
              Clear Edges
            </ElButton>
          </ElTooltip>
          <ElAutocomplete
            v-model="panelStore.angleToSet"
            placeholder="Set Angle"
            :fetch-suggestions="angleSuggestions"
            :trigger-on-focus="true"
            clearable
            hide-loading
            class="inline-input"
          >
            <template #append>
              <ElTooltip
                content="Set the angle parameter of selected non-boundary nodes [A]"
              >
                <ElButton
                  class="btn"
                  @click="clickSetAngle"
                  @change="changeSetAngle"
                  :disabled="!props.checkCanDoCommand.a.value"
                  :icon="EditPen"
                />
              </ElTooltip>
            </template>
          </ElAutocomplete>
          <ElAutocomplete
            v-model="panelStore.angleToAdd"
            placeholder="Add Angle"
            :fetch-suggestions="angleSuggestions"
            :trigger-on-focus="true"
            clearable
            class="inline-input"
          >
            <template #append>
              <ElTooltip
                content="Add to the current angle of selected non-boundary nodes [Shift+A]"
              >
                <ElButton
                  class="btn"
                  @click="clickAddAngle"
                  @change="changeAddAngle"
                  :disabled="!props.checkCanDoCommand.A.value"
                  :icon="Plus"
                />
              </ElTooltip>
            </template>
          </ElAutocomplete>
          Any selection:
          <ElTooltip content="Delete selected nodes or edges [X]">
            <ElButton
              class="btn"
              @click="emit('command', 'x')"
              :disabled="!props.checkCanDoCommand.x.value"
            >
              Delete
            </ElButton>
          </ElTooltip>
          Sequential edges:
          <ElTooltip content="Define a path from input to output boundary [S]">
            <ElButton
              class="btn"
              @click="emit('command', 's')"
              :disabled="!props.checkCanDoCommand.s.value"
            >
              Define Path
            </ElButton>
          </ElTooltip>
          <ElTooltip
            content="Remove all paths touching selected edges [Shift+S]"
          >
            <ElButton
              class="btn"
              @click="emit('command', 'S')"
              :disabled="!props.checkCanDoCommand.S.value"
            >
              Clear Path
            </ElButton>
          </ElTooltip>
        </div>
      </div>
    </Transition>

    <!-- Left panel (rewrite) -->
    <Transition name="panel-left">
      <div class="panely panel-left" v-show="show && panelStore.rewriteMode">
        <div>
          <ElTooltip content="For developer testing [`]">
            <ElButton class="btn" @click="emit('command', '`')">
              [Dev]
            </ElButton>
          </ElTooltip>
          Select single edge:
          <ElTooltip
            content="Hadamard Cancellation: Removes a Hadamard edge between degree-2 nodes [H]"
          >
            <ElButton
              class="btn"
              @click="emit('command', 'h')"
              :disabled="!props.checkCanDoCommand.h1.value"
            >
              Remove Edge+Nodes
            </ElButton>
          </ElTooltip>
          <ElTooltip
            content="Reverse Hadamard Cancellation: Inserts two Hadamard edges by adding two Z nodes [Shift+H]"
          >
            <ElButton
              class="btn"
              @click="emit('command', 'H')"
              :disabled="!props.checkCanDoCommand.H.value"
            >
              Insert 2 Nodes
            </ElButton>
          </ElTooltip>
          Select single node:
          <ElTooltip
            content="Identity Removal: Removes a degree-2 node by merging its neighbors [H]"
          >
            <ElButton
              class="btn"
              @click="emit('command', 'h')"
              :disabled="!props.checkCanDoCommand.h2.value"
            >
              Remove Degree-2
            </ElButton>
          </ElTooltip>
          <ElTooltip
            content="Local Complementation: Removes a ±π/2 node by toggling all edges between its neighbors and adding ∓π/2 [C]"
          >
            <ElButton
              class="btn"
              @click="emit('command', 'c')"
              :disabled="!props.checkCanDoCommand.c.value"
            >
              Complementation
            </ElButton>
          </ElTooltip>
          Select two nodes:
          <ElTooltip
            content="Pivot: Removes two nodes with angles 0 or π by toggling certain edges between their neighbors [P]"
          >
            <ElButton
              class="btn"
              @click="emit('command', 'p')"
              :disabled="!props.checkCanDoCommand.p.value"
            >
              Pivot
            </ElButton>
          </ElTooltip>
          Select multiple nodes:
          <ElTooltip
            content="Reverse Complementation: Adds a ±π/2 node connected to the selected nodes by toggling all edges and adding ±π/2 [Shift+C]"
          >
            <ElButton
              class="btn"
              @click="emit('command', 'C')"
              :disabled="!props.checkCanDoCommand.C.value"
            >
              Complementation
            </ElButton>
          </ElTooltip>
          Reverse pivot:
          <ElRadioGroup v-model="panelStore.selectMode">
            <ElRadioButton label="a">A</ElRadioButton>
            <ElRadioButton label="">Both</ElRadioButton>
            <ElRadioButton label="B">B</ElRadioButton>
          </ElRadioGroup>
          <ElTooltip
            content="Reverse Pivot: Adds two nodes by toggling edges between three groups of selections (A, A+B, and B) [Shift+P]"
          >
            <ElButton
              class="btn"
              @click="emit('command', 'P')"
              :disabled="!props.checkCanDoCommand.P.value"
            >
              Pivot
            </ElButton>
          </ElTooltip>
        </div>
      </div>
    </Transition>

    <!-- Right Panel -->
    <Transition name="panel-right">
      <div class="panely panel-right" v-show="show">
        <div>
          Force simulation:
          <ElSwitch
            v-model="styleStore.layout.forceLayout"
            inactive-text=""
            active-text="Relax nodes"
          />
          <ElSwitch
            v-model="styleStore.layout.fixBoundaries"
            inactive-text=""
            active-text="Fix boundaries"
          />
          View Settings:
          <ElSwitch
            v-model="styleStore.view.grid.visible"
            inactive-text=""
            active-text="Grid"
          />
          <ElSwitch
            v-model="styleStore.layout.snapToGrid"
            inactive-text=""
            active-text="Snap to grid"
          />
          <ElSwitch
            v-model="styleStore.view.scalingObjects"
            inactive-text=""
            active-text="Scale nodes"
          />
          <ElButton class="btn" @click="emit('command', 'resetView')">
            Reset View
          </ElButton>
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
  /* prettier-ignore */
  grid-template-columns: [left] var(--left-width) [leftmid] 1fr [rightmid] var(
      --right-width) [right];
  /* prettier-ignore */
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
.btn-row-group > .btn:not(:first-child) {
  margin-left: 5px;
}
.panel-top-right {
  height: 100%;
  display: flex;
  justify-content: right;
  align-items: center;
  flex-grow: 1;
}
.version {
  color: #999;
}
</style>
