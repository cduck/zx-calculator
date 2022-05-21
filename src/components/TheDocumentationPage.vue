<script setup>
import {
  ref,
  shallowRef,
  computed,
  onBeforeMount,
  onMounted,
  onBeforeUnmount,
} from "vue";
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
  ElLink,
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
import MenuBars from "@/icons/MenuBars.vue";
import { default as WelcomePage } from "@/doc/welcome.md";

// Documentation CSS
import "github-markdown-css/github-markdown-light.css";
import "prismjs/themes/prism.css";

const narrowScreenMediaQuery = "(max-width: 700px)";
const showMenu = ref(false);
const narrowScreen = ref(false);
const docContent = ref(null);
let windowMatchMedia;
const menuComponent = ref(null);
const menuInfo = {};
const menuItemComponents = {};
const currentSelected = ref(null);
let contentComponentType = shallowRef(WelcomePage);

// Life cycle listeners
onBeforeMount(() => {
  windowMatchMedia = window.matchMedia(narrowScreenMediaQuery);
  narrowScreen.value = windowMatchMedia.matches;
  windowMatchMedia.addEventListener("change", screenChange);
});
onMounted(() => {
  menuInfo.defaultOpeneds = menuComponent.value.$props.defaultOpeneds;
  menuInfo.uniqueOpened = menuComponent.value.$props.uniqueOpened;
  menuInfo.rootList = [];
  menuInfo.rootMap = {};
  menuInfo.globalList = [];
  for (const item of menuComponent.value.$slots.default()) {
    buildMenuInfo(
      item,
      menuInfo.rootList,
      menuInfo.globalList,
      menuInfo.rootMap,
      []
    );
  }
  currentSelected.value = menuComponent.value.$props.defaultActive;
});
onBeforeUnmount(() => {
  windowMatchMedia.removeEventListener("change", screenChange);
});

const buildMenuInfo = (component, appendTo, globalList, keyTo, path) => {
  let title = component?.props?.title;
  const titleSlot =
    component?.type?.name === "ElMenuItem"
      ? component?.children?.default
      : component?.children?.title;
  if (!title && titleSlot) {
    title = "";
    for (const child of titleSlot()) {
      if (typeof child.children === "string") {
        title += child.children;
      }
    }
    if (!title) title = undefined;
  }
  if (component?.type?.name === "ElSubMenu") {
    const subList = [];
    for (const subItem of component.children.default()) {
      const subPath = [...path, component.props.index];
      buildMenuInfo(subItem, subList, globalList, keyTo, subPath);
    }
    const info = {
      id: component.props.index,
      path: [...path, component.props.index],
      title: title,
      children: subList,
    };
    appendTo.push(info);
    keyTo[info.id] = info;
  } else if (component?.type?.name === "ElMenuItem") {
    const info = {
      id: component.props.index,
      path: [...path, component.props.index],
      title: title,
      pageName: component.props.index,
      index: globalList.length,
    };
    appendTo.push(info);
    globalList.push(info);
    keyTo[info.id] = info;
  } else if (component?.type?.name === "ElMenuItemGroup") {
    for (const subItem of component.children.default()) {
      buildMenuInfo(subItem, appendTo, globalList, keyTo, path);
    }
  } else {
    console.warn("Unknown tag", component?.type?.name);
  }
};

const screenChange = () => {
  narrowScreen.value = windowMatchMedia.matches;
};

const itemChange = (el) => {
  menuItemComponents[el?.$props?.index] = el;
};

const nextName = computed(() => {
  if (!currentSelected.value) return null;
  const i = menuInfo.rootMap[currentSelected.value].index + 1;
  if (!menuInfo.globalList[i]) return null;
  return menuInfo.globalList[i].title;
});
const prevName = computed(() => {
  if (!currentSelected.value) return null;
  const i = menuInfo.rootMap[currentSelected.value].index - 1;
  if (!menuInfo.globalList[i]) return null;
  return menuInfo.globalList[i].title;
});
const openExternalLink = computed(() => {
  if (!currentSelected.value) return "";
  const fname = menuInfo.rootMap[currentSelected.value].pageName;
  return `https://github.com/cduck/zx-calculator/blob/main/src/doc/${fname}.md`;
});

const nextPage = () => {
  goToPageOffset(1);
};
const prevPage = () => {
  goToPageOffset(-1);
};
const goToPageOffset = (offset) => {
  if (!currentSelected.value) return null;
  const i = menuInfo.rootMap[currentSelected.value].index + offset;
  if (!menuInfo.globalList[i]) return null;
  const info = menuInfo.globalList[i];
  menuItemComponents[info.id].handleClick();
};

const menuSelected = (index) => {
  // Record selection
  currentSelected.value = index;
  // Scroll
  if (narrowScreen.value) {
    showMenu.value = false;
    docContent.value.$el.scrollIntoView();
  }
  // Load content
  if (index === "welcome") {
    contentComponentType.value = WelcomePage;
  } else {
    import(`../doc/${index}.md`).then((loaded) => {
      contentComponentType.value = loaded.default;
    });
  }
};

const emit = defineEmits(["close"]);
</script>

<template>
  <ElContainer :class="{ 'layout-container': true, 'show-menu': showMenu }">
    <ElHeader class="top-header">
      <ElLink :underline="false" @click="emit('close')"
        ><ElIcon :size="20"><Close /></ElIcon
      ></ElLink>
      <div style="flex-grow: 1; margin: 0"></div>
      <ElLink
        style="margin-right: 1.5em"
        :underline="false"
        :href="openExternalLink"
        target="_blank"
        rel="noopener"
        ><ElIcon :size="15"><ArrowUpRightFromSquare /></ElIcon
      ></ElLink>
      <ElLink :underline="false" @click="showMenu = !showMenu"
        ><ElIcon :size="17"><MenuBars /></ElIcon
      ></ElLink>
    </ElHeader>
    <ElContainer
      :direction="showMenu && narrowScreen ? 'vertical' : 'horizontal'"
    >
      <ElAside>
        <ElHeader class="menu-header">
          <ElLink :underline="false" @click="emit('close')"
            ><ElIcon :size="20"><Close /></ElIcon
          ></ElLink>
          <div style="flex-grow: 1; margin: 0"></div>
          <ElLink
            :underline="false"
            :href="openExternalLink"
            target="_blank"
            rel="noopener"
            ><ElIcon :size="15"><ArrowUpRightFromSquare /></ElIcon
          ></ElLink>
        </ElHeader>
        <ElMenu
          :default-openeds="['topics']"
          :unique-opened="true"
          default-active="welcome"
          background-color="#fcfcfc"
          @select="menuSelected"
          ref="menuComponent"
        >
          <ElSubMenu index="topics">
            <template #title
              ><ElIcon><Reading /></ElIcon>ZX Calculator</template
            >
            <ElMenuItem index="welcome" :ref="itemChange"
              ><ElIcon><Sunrise /></ElIcon>Welcome</ElMenuItem
            >
            <ElMenuItem index="zxintro" :ref="itemChange"
              ><ElIcon><Guide /></ElIcon>ZX Calculus Intro</ElMenuItem
            >
            <ElMenuItem index="graphlike" :ref="itemChange"
              ><ElIcon><Share /></ElIcon>Graph-Like Diagrams</ElMenuItem
            >
            <ElMenuItem index="edit" :ref="itemChange"
              ><ElIcon><Edit /></ElIcon>Graph Editing</ElMenuItem
            >
            <ElMenuItem index="rewrite" :ref="itemChange"
              ><ElIcon><MagicStick /></ElIcon>Graph Rewrite</ElMenuItem
            >
            <ElMenuItem index="export" :ref="itemChange"
              ><ElIcon><FolderOpened /></ElIcon>Import &amp; Export</ElMenuItem
            >
          </ElSubMenu>
          <ElSubMenu index="ref">
            <template #title
              ><ElIcon><Tickets /></ElIcon>Reference</template
            >
            <ElSubMenu index="ref-menu">
              <template #title
                ><ElIcon><SetUp /></ElIcon>Toolbar</template
              >
              <ElMenuItem index="menu-hide" :ref="itemChange"
                >Hide &amp; Show</ElMenuItem
              >
              <ElMenuItem index="menu-mode" :ref="itemChange"
                >Graph Mode</ElMenuItem
              >
              <ElMenuItem index="menu-undo" :ref="itemChange"
                >Undo History</ElMenuItem
              >
              <ElMenuItem index="menu-snapshot" :ref="itemChange"
                >Snapshots</ElMenuItem
              >
              <ElMenuItem index="menu-import" :ref="itemChange"
                >Import</ElMenuItem
              >
              <ElMenuItem index="menu-export" :ref="itemChange"
                >Export</ElMenuItem
              >
              <ElMenuItem index="menu-screenshot" :ref="itemChange"
                >Screenshot</ElMenuItem
              >
              <ElMenuItem index="menu-documentation" :ref="itemChange"
                >Documentation</ElMenuItem
              >
              <ElMenuItem index="menu-version" :ref="itemChange"
                >Version</ElMenuItem
              >
            </ElSubMenu>
            <ElSubMenu index="ref-edit">
              <template #title
                ><ElIcon><Edit /></ElIcon>Edit Commands</template
              >
              <ElMenuItem index="edit-clear" :ref="itemChange"
                >Clear Graph</ElMenuItem
              >
              <ElMenuItem index="edit-b" :ref="itemChange"
                >New Boundary</ElMenuItem
              >
              <ElMenuItem index="edit-n" :ref="itemChange">New Node</ElMenuItem>
              <ElMenuItem index="edit-e" :ref="itemChange"
                >Toggle Edges</ElMenuItem
              >
              <ElMenuItem index="edit-shift+e" :ref="itemChange"
                >Clear Edges</ElMenuItem
              >
              <ElMenuItem index="edit-a" :ref="itemChange"
                >Set Angle</ElMenuItem
              >
              <ElMenuItem index="edit-shift+a" :ref="itemChange"
                >Add Angle</ElMenuItem
              >
              <ElMenuItem index="edit-r" :ref="itemChange"
                >Toggle Color</ElMenuItem
              >
              <ElMenuItem index="edit-x" :ref="itemChange">Delete</ElMenuItem>
              <ElMenuItem index="edit-s" :ref="itemChange"
                >Define Path</ElMenuItem
              >
              <ElMenuItem index="edit-shift+s" :ref="itemChange"
                >Clear Path</ElMenuItem
              >
            </ElSubMenu>
            <ElSubMenu index="ref-rewrite">
              <template #title
                ><ElIcon><MagicStick /></ElIcon>Rewrite Commands</template
              >
              <ElMenuItem index="rewrite-r" :ref="itemChange"
                >Toggle Color</ElMenuItem
              >
              <ElMenuItem index="rewrite-h" :ref="itemChange"
                >Remove Edge (+ Nodes)</ElMenuItem
              >
              <ElMenuItem index="rewrite-shift+h" :ref="itemChange"
                >Insert Nodes</ElMenuItem
              >
              <ElMenuItem index="rewrite-j" :ref="itemChange"
                >Remove Degree-2 Node</ElMenuItem
              >
              <ElMenuItem index="rewrite-shift+j" :ref="itemChange"
                >Split Node</ElMenuItem
              >
              <ElMenuItem index="rewrite-c" :ref="itemChange"
                >Local Complementation</ElMenuItem
              >
              <ElMenuItem index="rewrite-shift+c" :ref="itemChange"
                >Reverse Complementation</ElMenuItem
              >
              <ElMenuItem index="rewrite-p" :ref="itemChange">Pivot</ElMenuItem>
              <ElMenuItem index="rewrite-shift+p" :ref="itemChange"
                >Reverse Pivot</ElMenuItem
              >
            </ElSubMenu>
            <ElSubMenu index="ref-view">
              <template #title
                ><ElIcon><View /></ElIcon>View Options</template
              >
              <ElMenuItemGroup title="View">
                <ElMenuItem index="view-view-fit" :ref="itemChange"
                  >Zoom to Fit</ElMenuItem
                >
                <ElMenuItem index="view-view-reset" :ref="itemChange"
                  >Reset View</ElMenuItem
                >
                <ElMenuItem index="view-grid-realign" :ref="itemChange"
                  >Realign to Grid</ElMenuItem
                >
                <ElMenuItem index="view-grid-show" :ref="itemChange"
                  >Show Grid</ElMenuItem
                >
                <ElMenuItem index="view-grid-snap" :ref="itemChange"
                  >Snap to Grid</ElMenuItem
                >
                <ElMenuItem index="view-scale" :ref="itemChange"
                  >Scale Nodes</ElMenuItem
                >
              </ElMenuItemGroup>
              <ElMenuItemGroup title="Force Simulation">
                <ElMenuItem index="view-relax-nodes" :ref="itemChange"
                  >Relax Nodes</ElMenuItem
                >
                <ElMenuItem index="view-fix-boundaries" :ref="itemChange"
                  >Fix Boundaries</ElMenuItem
                >
              </ElMenuItemGroup>
            </ElSubMenu>
          </ElSubMenu>
        </ElMenu>
      </ElAside>

      <ElContainer>
        <ElHeader class="prev-next-header">
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
        <ElMain ref="docContent">
          <component :is="contentComponentType" />
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
  </ElContainer>
</template>

<style>
.layout-container {
  min-width: calc(100vw - 60px);
  background-color: #fff;
}
@media (min-width: 1060px) {
  .layout-container {
    width: calc(1000px);
  }
}
.layout-container > .el-header {
  width: 100%;
  display: block;
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

@media not (max-width: 700px) {
  .layout-container .top-header {
    display: none;
  }
}
@media (max-width: 700px) {
  .layout-container .el-aside {
    width: 100%;
    display: none;
    border: none;
  }
  .layout-container.show-menu .el-aside {
    display: block;
  }
  .layout-container .menu-header {
    display: none;
  }
  .layout-container .prev-next-header {
    display: none;
  }
}
</style>

<style>
.layout-container .markdown-body {
  padding: 0 40px 20px 40px;
  background-color: white;
}
</style>
