<script setup>
import { ref, watch } from "vue";
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
} from "@element-plus/icons-vue";
import ModalOverlay from "@/components/ModalOverlay.vue";
import { usePanelStore } from "@/stores/panels.js";
import { useStyleStore } from "@/stores/graphStyle.js";
import { version, versionKind } from "@/version.js";
import * as angles from "@/angles.js";

const show = ref(true);

const panelStore = usePanelStore();
const styleStore = useStyleStore();

// Angle input text fields
const angleSuggestions = (query, callback) => {
  callback(angles.DEFAULT_SUGGESTIONS);
};

// Import and export
const exportVisible = ref(false);
const helpVisible = ref(false);
const pyzxJsonText = ref("");
const theUrl = ref("");
const exportCopyButtonLabel = ref("Copy");
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
const restoreCopyButton = () => {
  exportCopyButtonLabel.value = "Copy";
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
  importVisible: Boolean,
  importErrorMsg: String,
});
const emit = defineEmits([
  "command",
  "importPyzx",
  "exportPyzx",
  "saveImageContent",
  "update:importVisible",
  "update:importErrorMsg",
]);
</script>

<template>
  <div class="grid-container">
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
                    emit('update:importVisible', !importVisible);
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
                  @click="emit('command', 'a')"
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
                  @click="emit('command', 'A')"
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
          Select single edge:
          <ElTooltip
            content="Hadamard Cancellation: Removes a Hadamard edge between degree-2 nodes [H]"
          >
            <ElButton
              class="btn"
              @click="emit('command', 'h')"
              :disabled="!props.checkCanDoCommand.h.value"
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
          Select edges from node:
          <ElAutocomplete
            v-model="panelStore.angleToSplit"
            placeholder="Split Node"
            :fetch-suggestions="angleSuggestions"
            :trigger-on-focus="true"
            clearable
            hide-loading
            class="inline-input"
          >
            <template #append>
              <ElTooltip
                content="Splits a node into two nodes (connected by a degree-2 node) with the selected edges all on one side [Shift+J]"
              >
                <ElButton
                  class="btn"
                  @click="emit('command', 'J')"
                  :disabled="!props.checkCanDoCommand.J.value"
                  :icon="Scissor"
                />
              </ElTooltip>
            </template>
          </ElAutocomplete>
          Select single node:
          <ElTooltip
            content="Identity Removal: Removes a degree-2 node by merging its neighbors [J]"
          >
            <ElButton
              class="btn"
              @click="emit('command', 'j')"
              :disabled="!props.checkCanDoCommand.j.value"
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
          Select multiple nodes:
          <ElTooltip
            content="Reverse Complementation: Adds a ±π/2 node connected to the selected nodes by toggling all edges and adding ±π/2 [Shift+C or Shift+V]"
          >
            <ElButton
              class="btn"
              @click="emit('command', 'C')"
              :disabled="!props.checkCanDoCommand.C.value"
            >
              Rev. Complementation
            </ElButton>
          </ElTooltip>
          <ElTooltip
            content="Reverse Pivot: Adds two nodes by toggling edges between three sets of nodes (A\B, B\A, and A∩B) [Shift+P or Shift+O]"
          >
            <ElButton
              class="btn"
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
          </ElTooltip>
        </div>
      </div>
    </Transition>

    <!-- Right Panel -->
    <Transition name="panel-right">
      <div class="panely panel-right" v-show="show">
        <div>
          View:
          <ElButton
            class="btn"
            :icon="FullScreen"
            @click="emit('command', 'resetView')"
          >
            Reset View
          </ElButton>
          <a
            class="btn"
            :href="oldSaveImageUrl"
            target="_blank"
            @click="saveImage()"
          >
            <ElButton style="width: 100%" :icon="Camera">Screenshot</ElButton>
          </a>
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
        accept=".json,application/json,text/json"
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
        style="max-width: 13em; width: calc(50% - 6px); margin-top: 10px"
        @click="copyPyzxJsonExport"
      >
        <span :innerText="exportCopyButtonLabel"></span>
      </ElButton>
      <a
        class="btn"
        :href="savePyzxJsonExportLink()"
        download="zx-calculator.pyzx.json"
        style="margin-left: 12px"
      >
        <ElButton
          type="primary"
          style="max-width: 13em; width: calc(50% - 6px); margin-top: 10px"
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
</style>

<style>
.wide-upload .el-upload,
.wide-upload .el-upload .el-upload-dragger {
  width: 100%;
}
</style>
