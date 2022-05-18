<script setup>
import { computed } from "vue";
import {
  ElContainer,
  ElAside,
  ElMenu,
  ElSubMenu,
  ElMenuItemGroup,
  ElIcon,
  ElMain,
  ElHeader,
  ElFooter,
  ElButton,
} from "element-plus";
import {
  Close,
  ArrowLeft,
  ArrowRight,
  Sunrise,
  Reading,
  Guide,
  Share,
  FolderOpened,
  Tickets,
  Edit,
  MagicStick,
  View,
  SetUp,
} from "@element-plus/icons-vue";
import ArrowUpRightFromSquare from "@/icons/ArrowUpRightFromSquare.vue";
import IntroMd from "@/doc/IntroMd.md";
import "github-markdown-css/github-markdown-light.css";

const nextName = computed(() => {
  return "Next";
});
const prevName = computed(() => {
  return "Previous";
});

const openExternal = () => {
  //
};

const closeModal = () => {
  //
};

const nextPage = () => {
  //
};

const prevPage = () => {
  //
};

const menuSelected = (index, indexPath, args) => {
  console.log("select", args);
};

const emit = defineEmits(["close"]);
</script>

<template>
  <ElContainer class="layout-container">
    <ElAside>
      <ElHeader>
        <ElButton type="text" @click="emit('close')"
          ><ElIcon :size="20"><Close /></ElIcon
        ></ElButton>
        <div style="flex-grow: 1; margin: 0"></div>
        <ElButton type="text">
          <ElIcon :size="15"><ArrowUpRightFromSquare /></ElIcon>
        </ElButton>
      </ElHeader>
      <ElMenu
        :default-openeds="['topics', 'ref']"
        default-active="welcome"
        background-color="#fcfcfc"
        router
        @select="menuSelected"
      >
        <ElSubMenu index="topics">
          <template #title>
            <ElIcon><Reading /></ElIcon>ZX Calculator
          </template>
          <ElMenuItem index="welcome">
            <ElIcon><Sunrise /></ElIcon>Welcome
          </ElMenuItem>
          <ElMenuItem index="zxintro">
            <ElIcon><Guide /></ElIcon>ZX Calculus Intro
          </ElMenuItem>
          <ElMenuItem index="graphlike">
            <ElIcon><Share /></ElIcon>Graph-Like Diagrams
          </ElMenuItem>
          <ElMenuItem index="edit">
            <ElIcon><Edit /></ElIcon>Graph Editing
          </ElMenuItem>
          <ElMenuItem index="rewrite">
            <ElIcon><MagicStick /></ElIcon>Graph Rewrite
          </ElMenuItem>
          <ElMenuItem index="export">
            <ElIcon><FolderOpened /></ElIcon>Import &amp; Export
          </ElMenuItem>
        </ElSubMenu>
        <ElSubMenu index="ref">
          <template #title>
            <ElIcon><Tickets /></ElIcon>Reference
          </template>
          <ElSubMenu index="ref-menu">
            <template #title>
              <ElIcon><SetUp /></ElIcon>Toolbar
            </template>
            <ElMenuItem index="ref-menu:hide">Hide &amp; Show</ElMenuItem>
            <ElMenuItem index="ref-menu:mode">Graph Mode</ElMenuItem>
            <ElMenuItem index="ref-menu:undo">Undo History</ElMenuItem>
            <ElMenuItem index="ref-menu:snapshot">Snapshots</ElMenuItem>
            <ElMenuItem index="ref-menu:import">Import</ElMenuItem>
            <ElMenuItem index="ref-menu:export">Export</ElMenuItem>
            <ElMenuItem index="ref-menu:screenshot">Screenshot</ElMenuItem>
            <ElMenuItem index="ref-menu:documentation"
              >Documentation</ElMenuItem
            >
            <ElMenuItem index="ref-menu:version">Version</ElMenuItem>
          </ElSubMenu>
          <ElSubMenu index="ref-edit">
            <template #title>
              <ElIcon><Edit /></ElIcon>Edit Commands
            </template>
            <ElMenuItem index="ref-edit:clear">Clear Graph</ElMenuItem>
            <ElMenuItem index="ref-edit:b">New Boundary</ElMenuItem>
            <ElMenuItem index="ref-edit:n">New Node</ElMenuItem>
            <ElMenuItem index="ref-edit:e">Toggle Edges</ElMenuItem>
            <ElMenuItem index="ref-edit:shift+e">Clear Edges</ElMenuItem>
            <ElMenuItem index="ref-edit:a">Set Angle</ElMenuItem>
            <ElMenuItem index="ref-edit:shift+a">Add Angle</ElMenuItem>
            <ElMenuItem index="ref-edit:r">Toggle Color</ElMenuItem>
            <ElMenuItem index="ref-edit:x">Delete</ElMenuItem>
            <ElMenuItem index="ref-edit:s">Define Path</ElMenuItem>
            <ElMenuItem index="ref-edit:shift+s">Clear Path</ElMenuItem>
          </ElSubMenu>
          <ElSubMenu index="ref-rewrite">
            <template #title>
              <ElIcon><MagicStick /></ElIcon>Rewrite Commands
            </template>
            <ElMenuItem index="ref-rewrite:r">Toggle Color</ElMenuItem>
            <ElMenuItem index="ref-rewrite:h">Remove Edge (+ Nodes)</ElMenuItem>
            <ElMenuItem index="ref-rewrite:shift+h">Insert Nodes</ElMenuItem>
            <ElMenuItem index="ref-rewrite:j">Remove Degree-2 Node</ElMenuItem>
            <ElMenuItem index="ref-rewrite:shift+j">Split Node</ElMenuItem>
            <ElMenuItem index="ref-rewrite:c">Local Complementation</ElMenuItem>
            <ElMenuItem index="ref-rewrite:shift+c"
              >Reverse Complementation</ElMenuItem
            >
            <ElMenuItem index="ref-rewrite:p">Pivot</ElMenuItem>
            <ElMenuItem index="ref-rewrite:shift+p">Reverse Pivot</ElMenuItem>
          </ElSubMenu>
          <ElSubMenu index="ref-view">
            <template #title>
              <ElIcon><View /></ElIcon>View Options
            </template>
            <ElMenuItemGroup title="View">
              <ElMenuItem index="ref-view:">Zoom to Fit</ElMenuItem>
              <ElMenuItem index="ref-view:">Reset View</ElMenuItem>
              <ElMenuItem index="ref-view:">Realign to Grid</ElMenuItem>
              <ElMenuItem index="ref-view:">Show Grid</ElMenuItem>
              <ElMenuItem index="ref-view:">Snap to Grid</ElMenuItem>
              <ElMenuItem index="ref-view:">Scale Nodes</ElMenuItem>
            </ElMenuItemGroup>
            <ElMenuItemGroup title="Force Simulation">
              <ElMenuItem index="ref-view:">Relax Nodes</ElMenuItem>
              <ElMenuItem index="ref-view:">Fix Boundaries</ElMenuItem>
            </ElMenuItemGroup>
          </ElSubMenu>
        </ElSubMenu>
      </ElMenu>
    </ElAside>

    <ElContainer>
      <ElHeader>
        <ElButton
          type="text"
          :icon="ArrowLeft"
          @click="prevPage"
          v-if="prevName"
        >
          {{ prevName }}
        </ElButton>
        <div style="flex-grow: 1; margin: 0"></div>
        <ElButton type="text" @click="nextPage" v-if="nextName">
          {{ nextName }}<ElIcon class="el-icon--right"><ArrowRight /></ElIcon>
        </ElButton>
      </ElHeader>
      <ElMain>
        <IntroMd />
      </ElMain>
      <ElFooter>
        <ElButton
          type="text"
          :icon="ArrowLeft"
          @click="prevPage"
          v-if="prevName"
        >
          {{ prevName }}
        </ElButton>
        <div style="flex-grow: 1; margin: 0"></div>
        <ElButton type="text" @click="nextPage" v-if="nextName">
          {{ nextName }}<ElIcon class="el-icon--right"><ArrowRight /></ElIcon>
        </ElButton>
      </ElFooter>
    </ElContainer>
  </ElContainer>
</template>

<style>
.layout-container {
  width: calc(100vw - 60px);
  background-color: #fff;
}
@media (min-width: 1060px) {
  .layout-container {
    width: calc(1000px);
  }
}
.layout-container .el-aside {
  color: var(--el-text-color-primary);
  border-right: 1.5px solid hsla(210, 18%, 91%, 1);
  padding: 0;
  width: 252px;
}
.layout-container .el-menu {
  border: none;
}
.layout-container .el-aside > .el-menu > *:first-child {
  margin-top: -10px;
  color: red;
}
.layout-container .el-menu,
.layout-container .el-sub-menu .el-menu {
}
.layout-container .el-main {
  color: var(--el-text-color-primary);
  padding: 0;
}
.layout-container .el-header,
.layout-container .el-footer {
  height: 50px;
  display: flex;
}
.layout-container .el-header > *,
.layout-container .el-footer > * {
  margin-top: auto;
  margin-bottom: auto;
}
.layout-container .el-aside .el-header {
  background: #fcfcfc;
}
.layout-container .el-footer {
  border-top: 1.5px solid hsla(210, 18%, 91%, 1);
}
</style>

<style>
.layout-container .markdown-body {
  padding: 0 40px 20px 40px;
  background-color: white;
}
</style>
