<script setup>
import { ref, toRef, watch } from "vue";
import {
  ElInput,
  ElButton,
  ElButtonGroup,
  ElSwitch,
  ElTooltip,
  ElAutocomplete,
  ElUpload,
} from "element-plus";
import {
  ArrowDownBold,
  EditPen,
  Plus,
  Scissor,
  UploadFilled,
  Camera,
  QuestionFilled,
  FullScreen,
  Rank,
  Grid,
} from "@element-plus/icons-vue";
import ModalOverlay from "@/components/ModalOverlay.vue";
import { usePanelStore } from "@/stores/panels.js";
import { useStyleStore } from "@/stores/graphStyle.js";
import { version, versionKind } from "@/version.js";
import * as angles from "@/angles.js";

const show = ref(true);

const panelStore = usePanelStore();
const styleStore = useStyleStore();

// Tooltip logic
const leftTooltipTarget = ref();
const leftTooltipVisible = ref(false);
const leftTooltipContent = ref("");
const leftTooltipMouseEnter = (e) => {
  leftTooltipTarget.value = e.currentTarget;
  leftTooltipVisible.value = true;
  leftTooltipContent.value = e.currentTarget.getAttribute("tooltip");
  window.clearTimeout(leftTooltipHide.id);
};
const leftTooltipMouseLeave = () => {
  window.clearTimeout(leftTooltipHide.id);
  leftTooltipHide.id = window.setTimeout(leftTooltipHide, 100);
};
const leftTooltipHide = () => {
  leftTooltipVisible.value = false;
};

// Angle input text fields
const setAngleInput = ref();
const addAngleInput = ref();
const splitNodeInput = ref();
const closeSuggestions = () => {
  setAngleInput.value.close();
  addAngleInput.value.close();
  splitNodeInput.value.close();
};
const angleSuggestions = (query, callback) => {
  callback(angles.DEFAULT_SUGGESTIONS);
};

// Import and export
const importVisible = ref(false);
const exportVisible = ref(false);
const helpVisible = ref(false);
const pyzxJsonText = ref("");
const theUrl = ref("");
const exportCopyButtonLabel = ref("Copy");
const exportCopy2ButtonLabel = ref("Copy Python");
let oldSavePyzxObjUrl;
let savePyzxExportStr;
const abbreviateStr = (str, cut) => {
  str = str.toString();
  cut = cut ?? 100;
  if (str.length < cut) return str;
  const left = str.slice(0, Math.floor(cut / 2 - 2));
  const right = str.slice(-Math.floor(cut / 2 - 2));
  return `${left} … ${right}`;
};
const importPyzxJsonFileTriggered = (args) => {
  args.onError(""); // Don't show the file in the list UI
  args.file.text().then((str) => {
    // Put text contents into text box below
    pyzxJsonText.value = str;
  });
};
const copyPyzxJsonExport = () => {
  const showMsg = (msg) => {
    exportCopyButtonLabel.value = msg;
    window.clearTimeout(restoreCopyButton.id);
    restoreCopyButton.id = window.setTimeout(restoreCopyButton, 3000);
  };
  navigator.clipboard.writeText(savePyzxExportStr || "").then(
    () => {
      showMsg("Copied!");
    },
    () => {
      showMsg("Failed");
    }
  );
};
const copy2PyzxJsonExport = () => {
  const showMsg = (msg) => {
    exportCopy2ButtonLabel.value = msg;
    window.clearTimeout(restoreCopy2Button.id);
    restoreCopy2Button.id = window.setTimeout(restoreCopy2Button, 3000);
  };
  const safeStr = (savePyzxExportStr || "").replaceAll("'''", "???");
  const str2 = `# Original graph: ${theUrl.value}
g = pyzx.Graph.from_json(r'''${safeStr}''')
pyzx.draw(g)`;
  navigator.clipboard.writeText(str2).then(
    () => {
      showMsg("Copied!");
    },
    () => {
      showMsg("Failed");
    }
  );
};
const restoreCopyButton = () => {
  exportCopyButtonLabel.value = "Copy";
};
const restoreCopy2Button = () => {
  exportCopy2ButtonLabel.value = "Copy Python";
};
const savePyzxJsonExportLink = () => {
  savePyzxExportStr = props.pyzxJsonOutStr;
  const file = new Blob([savePyzxExportStr || ""], {
    type: "application/json",
  });
  URL.revokeObjectURL(oldSavePyzxObjUrl);
  oldSavePyzxObjUrl = URL.createObjectURL(file);
  return oldSavePyzxObjUrl;
};
watch(exportVisible, (vis) => {
  if (!vis) {
    savePyzxExportStr = "";
    URL.revokeObjectURL(oldSavePyzxObjUrl);
  } else {
    theUrl.value = location.href;
  }
});

// Save SVG image
let oldSaveImageUrl = ref("");
const saveImage = () => {
  const file = new Blob(props.svgOutStrGet() || [""], {
    type: "image/svg+xml",
  });
  URL.revokeObjectURL(oldSaveImageUrl.value);
  oldSaveImageUrl.value = URL.createObjectURL(file);
};

const props = defineProps({
  checkCanDoCommand: Object,
  pyzxJsonOutStr: String,
  svgOutStrGet: Function,
  importErrorMsg: String,
  modalVisible: Boolean,
  dragoverVisible: Boolean,
});
const emit = defineEmits([
  "command",
  "importPyzx",
  "exportPyzx",
  "saveImageContent",
  "update:importErrorMsg",
  "update:modalVisible",
]);
watch(toRef(props, "modalVisible"), (newVis) => {
  if (!newVis) {
    importVisible.value = exportVisible.value = helpVisible.value = false;
  }
});
watch(
  () => [importVisible.value, exportVisible.value, helpVisible.value],
  () => {
    emit(
      "update:modalVisible",
      importVisible.value || exportVisible.value || helpVisible.value
    );
  }
);
</script>

<template>
  <div class="grid-container">
    <!-- Drag over indicator -->
    <div class="dragover-box" v-show="dragoverVisible"></div>

    <!-- Show panel button -->
    <Transition name="btn-fade">
      <div class="panelx show-btn" v-show="!show">
        <div>
          <ElButton
            @click="show = !show"
            style="width: 6ch"
            :icon="ArrowDownBold"
          />
        </div>
      </div>
    </Transition>

    <!-- Top panel -->
    <Transition name="panel-top">
      <div class="panelx panel-top" v-show="show">
        <div>
          <ElButton class="btn" style="width: 6ch" @click="show = !show">
            Hide
          </ElButton>
          <ElSwitch
            v-model="panelStore.rewriteMode"
            inactive-text="Edit"
            active-text="Rewrite"
            inactive-color="#eb0"
          />
          <div class="btn-row-group">
            <ElButtonGroup>
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
            </ElButtonGroup>
          </div>
          <div class="panel-top-right">
            <div class="btn-row-group">
              <ElButtonGroup>
                <ElButton
                  @click="
                    emit('update:importErrorMsg', '');
                    importVisible = !importVisible;
                  "
                >
                  Import
                </ElButton>
                <ElButton
                  @click="
                    emit('exportPyzx');
                    exportVisible = !exportVisible;
                  "
                >
                  Export
                </ElButton>
              </ElButtonGroup>
              <a
                class="btn"
                :href="oldSaveImageUrl"
                target="_blank"
                @click="saveImage()"
              >
                <ElButton :icon="Camera" />
              </a>
              <ElButton
                class="btn"
                :icon="QuestionFilled"
                @click="helpVisible = !helpVisible"
              />
            </div>
            <div
              class="version"
              :innerText="`v${version} ${versionKind}`"
            ></div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Left panel (edit) -->
    <Transition name="panel-left">
      <div class="panely panel-left" v-show="show && !panelStore.rewriteMode">
        <div>
          <ElTooltip
            v-model:visible="leftTooltipVisible"
            :virtual-ref="leftTooltipTarget"
            virtual-triggering
            trigger="hover"
            placement="right"
            :enterable="false"
            popper-class="singleton-tooltip"
            :content="leftTooltipContent"
            raw-content
          ></ElTooltip>
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Delete all nodes and edges"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 'clear')"
              :disabled="!props.checkCanDoCommand.clear.value"
            >
              Clear Graph
            </ElButton>
          </div>
          No selection:
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Create a boundary node [B]"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 'b')"
              :disabled="!props.checkCanDoCommand.b.value"
            >
              New Boundary
            </ElButton>
          </div>
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Create a Z node [N]"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 'n')"
              :disabled="!props.checkCanDoCommand.n.value"
            >
              New Node
            </ElButton>
          </div>
          Select nodes:
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Toggle edges between every selected node [E]"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 'e')"
              :disabled="!props.checkCanDoCommand.e.value"
            >
              Toggle Edges
            </ElButton>
          </div>
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Delete edges between every selected node [Shift+E]"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 'E')"
              :disabled="!props.checkCanDoCommand.E.value"
            >
              Clear Edges
            </ElButton>
          </div>
          <ElAutocomplete
            v-model="panelStore.angleToSet"
            placeholder="Set Angle"
            :fetch-suggestions="angleSuggestions"
            @select="() => emit('command', 'a')"
            @blur="closeSuggestions()"
            :trigger-on-focus="true"
            clearable
            hide-loading
            :class="{
              'inline-input': true,
              'disable-btn': !props.checkCanDoCommand.a.value,
            }"
            ref="setAngleInput"
          >
            <template #append>
              <div
                @mouseenter="leftTooltipMouseEnter"
                @mouseleave="leftTooltipMouseLeave"
                tooltip="Set the phase angle of selected non-boundary nodes to this value or expression [A]"
              >
                <ElButton
                  class="btn"
                  @click="emit('command', 'a')"
                  :disabled="!props.checkCanDoCommand.a.value"
                  :icon="EditPen"
                />
              </div>
            </template>
          </ElAutocomplete>
          <ElAutocomplete
            v-model="panelStore.angleToAdd"
            placeholder="Add Angle"
            :fetch-suggestions="angleSuggestions"
            @select="() => emit('command', 'A')"
            @blur="closeSuggestions()"
            :trigger-on-focus="true"
            clearable
            :class="{
              'inline-input': true,
              'disable-btn': !props.checkCanDoCommand.A.value,
            }"
            ref="addAngleInput"
          >
            <template #append>
              <div
                @mouseenter="leftTooltipMouseEnter"
                @mouseleave="leftTooltipMouseLeave"
                tooltip="Add this value or expression to the phase angle of selected non-boundary nodes [Shift+A]"
              >
                <ElButton
                  class="btn"
                  @click="emit('command', 'A')"
                  :disabled="!props.checkCanDoCommand.A.value"
                  :icon="Plus"
                />
              </div>
            </template>
          </ElAutocomplete>
          Any selection:
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Delete all selected nodes or edges [X]"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 'x')"
              :disabled="!props.checkCanDoCommand.x.value"
            >
              Delete
            </ElButton>
          </div>
          Sequential edges:
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Define a path from input to output boundary [S]"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 's')"
              :disabled="!props.checkCanDoCommand.s.value"
            >
              Define Path
            </ElButton>
          </div>
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Remove paths that use any selected edges [Shift+S]"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 'S')"
              :disabled="!props.checkCanDoCommand.S.value"
            >
              Clear Path
            </ElButton>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Left panel (rewrite) -->
    <Transition name="panel-left">
      <div class="panely panel-left" v-show="show && panelStore.rewriteMode">
        <div>
          Select single edge:
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Hadamard Cancellation:<br />Remove a Hadamard edge between degree-2 nodes [H]"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 'h')"
              :disabled="!props.checkCanDoCommand.h.value"
            >
              Remove Edge+Nodes
            </ElButton>
          </div>
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Reverse Hadamard Cancellation:<br />Insert two Hadamard edges by adding two Z nodes [Shift+H]"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 'H')"
              :disabled="!props.checkCanDoCommand.H.value"
            >
              Insert 2 Nodes
            </ElButton>
          </div>
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Pivot:<br />Remove a pair of adjacent nodes (A and B, must have angles 0 or π) by toggling Hadamard edges between three sets of their neighbors (neigbors of both, neighbors of only A, neighbors of only B) [P]"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 'p')"
              :disabled="!props.checkCanDoCommand.p.value"
            >
              Pivot
            </ElButton>
          </div>
          Select edges from node:
          <ElAutocomplete
            v-model="panelStore.angleToSplit"
            placeholder="Split Node"
            :fetch-suggestions="angleSuggestions"
            @select="() => emit('command', 'J')"
            @blur="closeSuggestions()"
            :trigger-on-focus="true"
            clearable
            hide-loading
            :class="{
              'inline-input': true,
              'disable-btn': !props.checkCanDoCommand.J.value,
            }"
            ref="splitNodeInput"
          >
            <template #append>
              <div
                @mouseenter="leftTooltipMouseEnter"
                @mouseleave="leftTooltipMouseLeave"
                tooltip="Split a node into two nodes (connected by a degree-2 node) with the selected edges (and given angle) separated from its other edges [Shift+J]"
              >
                <ElButton
                  class="btn"
                  @click="emit('command', 'J')"
                  :disabled="!props.checkCanDoCommand.J.value"
                  :icon="Scissor"
                />
              </div>
            </template>
          </ElAutocomplete>
          Select single node:
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Identity Removal:<br />Remove a degree-2 node by merging its two neighbors [J]"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 'j')"
              :disabled="!props.checkCanDoCommand.j.value"
            >
              Remove Degree-2
            </ElButton>
          </div>
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Local Complementation:<br />Remove a ±π/2 node by toggling Hadamard edges between all neighbors and adding ∓π/2 to each neighbor's angle [C]"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 'c')"
              :disabled="!props.checkCanDoCommand.c.value"
            >
              Complementation
            </ElButton>
          </div>
          Select multiple nodes:
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Reverse Complementation:<br />Add a new ±π/2 node connected to every selected node by toggling Hadamard edges between all nodes and adding ±π/2 to each node's angle [Shift+C or Shift+V]"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 'C')"
              :disabled="!props.checkCanDoCommand.C.value"
            >
              Rev. Complementation
            </ElButton>
          </div>
          <div
            @mouseenter="leftTooltipMouseEnter"
            @mouseleave="leftTooltipMouseLeave"
            tooltip="Reverse Pivot:<br />Add a pair of nodes (A and B, with angles 0 or π) by toggling Hadamard edges between three sets of nodes (neigbors of both, neighbors of only A, neighbors of only B) [Shift+P or Shift+O]<br /><br />Step 1 selection: the desired neighbors of node A<br />Step 2 selection: the temorary pivot node and the desired neighbors of node B"
          >
            <ElButton
              class="btn btn100"
              @click="emit('command', 'P')"
              :disabled="!props.checkCanDoCommand.P.value"
            >
              <span
                :innerText="
                  !props.checkCanDoCommand.P2.value
                    ? 'Reverse Pivot (1 of 2)'
                    : 'Reverse Pivot (2 of 2)'
                "
              ></span>
            </ElButton>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Right Panel -->
    <Transition name="panel-right">
      <div class="panely panel-right" v-show="show">
        <div>
          View:
          <ElButton class="btn" @click="emit('command', 'fitView')">
            <ElIcon
              class="el-icon--left"
              style="transform: rotate(45deg) scale(1.2)"
            >
              <Rank />
            </ElIcon>
            Zoom to Fit
          </ElButton>
          <ElButton
            class="btn"
            :icon="FullScreen"
            @click="emit('command', 'resetView')"
          >
            Reset View
          </ElButton>
          <ElButton
            class="btn"
            :icon="Grid"
            @click="emit('command', 'realign')"
          >
            Realign to Grid
          </ElButton>
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
        </div>
      </div>
    </Transition>

    <!-- Bottom Panel -->
    <Transition name="panel-bottom">
      <div class="panelx panel-bottom" v-show="show && false"><div></div></div>
    </Transition>
  </div>

  <!-- Pop-up views that cover the screen -->
  <!-- Import Graph -->
  <ModalOverlay
    :visible="importVisible"
    @update:visible="(v) => emit('update:importVisible', v)"
  >
    <div style="text-align: center; width: calc(80vw + 20px)">
      <ElUpload
        drag
        accept=".json,application/json,text/json,.txt,text/plain"
        :http-request="importPyzxJsonFileTriggered"
        action=""
        class="wide-upload"
      >
        <ElIcon class="el-icon--upload"><UploadFilled /></ElIcon>
        <div class="el-upload__text">
          PyZX JSON<br />Drop file here or <em>click to upload</em>
        </div>
      </ElUpload>
      <ElInput
        v-model="pyzxJsonText"
        type="textarea"
        rows="6"
        placeholder="or paste PyZX JSON data here"
      />
      <div
        style="color: #aa0000; margin: 10px 0"
        v-show="!!importErrorMsg"
        :innerText="importErrorMsg"
      ></div>
      <ElButton
        type="primary"
        style="max-width: 20em; width: 100%; margin-top: 10px"
        @click="emit('importPyzx', pyzxJsonText)"
      >
        Import
      </ElButton>
    </div>
  </ModalOverlay>
  <!-- Export Graph -->
  <ModalOverlay v-model:visible="exportVisible">
    <div style="text-align: center; width: calc(80vw + 20px)">
      <div style="margin-top: 6px; margin-bottom: 10px">
        Permalink:
        <a :href="theUrl" :innerText="abbreviateStr(theUrl)"></a>
      </div>
      <ElInput
        :value="pyzxJsonOutStr"
        type="textarea"
        rows="12"
        placeholder="PyZX JSON export data"
        readonly
      />
      <ElButton
        type="primary"
        style="max-width: 12em; width: calc(33% - 8px); margin-top: 10px"
        @click="copyPyzxJsonExport"
      >
        <span :innerText="exportCopyButtonLabel"></span>
      </ElButton>
      <ElButton
        type="primary"
        style="max-width: 12em; width: calc(33% - 8px); margin-top: 10px"
        @click="copy2PyzxJsonExport"
      >
        <span :innerText="exportCopy2ButtonLabel"></span>
      </ElButton>
      <a
        class="btn"
        :href="savePyzxJsonExportLink()"
        download="zx-calculator.pyzx.json"
        style="margin-left: 12px"
      >
        <ElButton
          type="primary"
          style="max-width: 12em; width: calc(33% - 8px); margin-top: 10px"
        >
          Save
        </ElButton>
      </a>
    </div>
  </ModalOverlay>
  <!-- Help Page -->
  <ModalOverlay v-model:visible="helpVisible">
    <div style="text-align: center; width: calc(80vw + 20px)">
      <h3 style="margin-top: 6px; margin-bottom: 10px">ZX Calculator — Help</h3>
    </div>
    <p><a href="https://zxcalculus.com/" target="_blank">zxcalculus.com</a></p>
  </ModalOverlay>
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
.dragover-box {
  grid-column: leftmid / rightmid;
  grid-row: topmid / bottommid;
}
.panelx,
.panely {
  opacity: 0.95;
  color: rgb(48, 49, 51);
}
.panelx {
  max-width: 100%;
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
.panel-right-enter-active {
  transition: transform 0.3s ease-out;
}
.btn-fade-enter-active {
  transition: opacity 0.3s cubic-bezier(0, 1, 0, 1);
}
.panel-top-leave-active,
.panel-bottom-leave-active,
.panel-left-leave-active,
.panel-right-leave-active {
  transition: transform 0.3s ease-out;
}
.btn-fade-leave-active {
  transition: opacity 0.3s cubic-bezier(1, 0, 1, 0);
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
.btn-fade-enter-from,
.btn-fade-leave-to {
  opacity: 0;
}

/* Panel content */
.panelx > div {
  overflow: scroll;
  display: flex;
  flex-direction: row;
  justify-content: left;
  align-items: center;
  white-space: nowrap;
}
.panelx > div > *:not(:last-child) {
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
.btn100 {
  width: 100%;
}
.sld {
  padding-left: 10px;
  padding-right: 10px;
}
.btn-row-group > .btn:not(:first-child) {
  margin-left: 5px;
}
a.btn {
  text-decoration: none;
}
.panelx > div > .panel-top-right {
  height: 100%;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  flex-grow: 1;
}
.version {
  color: #999;
  margin-left: 1em;
}

.dragover-box {
  background-color: rgba(64, 158, 255, 0.1);
  border: 2px dashed #409eff;
  border-radius: 6px;
  pointer-events: none;
}
</style>

<style>
.wide-upload .el-upload,
.wide-upload .el-upload .el-upload-dragger {
  width: 100%;
}

.singleton-tooltip {
  max-width: 240px;
}
</style>
