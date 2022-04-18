<script setup>
import {
  ElContainer,
  ElAside,
  ElMenu,
  ElSubMenu,
  ElMenuItemGroup,
  ElIcon,
  ElMain,
} from "element-plus";
import { Menu as IconMenu, Message, Setting } from "@element-plus/icons-vue";
import IntroMd from "@/doc/IntroMd.md";
import "github-markdown-css/github-markdown-light.css";
</script>

<template>
  <ElContainer class="layout-container">
    <ElAside>
      <ElMenu :default-openeds="['1', '3']">
        <ElSubMenu index="1">
          <template #title>
            <ElIcon><message /></ElIcon>Navigator One
          </template>
          <ElMenuItemGroup>
            <template #title>Group 1</template>
            <ElMenuItem index="1-1">Option 1</ElMenuItem>
            <ElMenuItem index="1-2">Option 2</ElMenuItem>
          </ElMenuItemGroup>
          <ElMenuItemGroup title="Group 2">
            <ElMenuItem index="1-3">Option 3</ElMenuItem>
          </ElMenuItemGroup>
          <ElSubMenu index="1-4">
            <template #title>Option4</template>
            <ElMenuItem index="1-4-1">Option 4-1</ElMenuItem>
          </ElSubMenu>
        </ElSubMenu>
        <ElSubMenu index="2">
          <template #title>
            <ElIcon><IconMenu /></ElIcon>Navigator Two
          </template>
          <ElMenuItemGroup>
            <template #title>Group 1</template>
            <ElMenuItem index="2-1">Option 1</ElMenuItem>
            <ElMenuItem index="2-2">Option 2</ElMenuItem>
          </ElMenuItemGroup>
          <ElMenuItemGroup title="Group 2">
            <ElMenuItem index="2-3">Option 3</ElMenuItem>
          </ElMenuItemGroup>
          <ElSubMenu index="2-4">
            <template #title>Option 4</template>
            <ElMenuItem index="2-4-1">Option 4-1</ElMenuItem>
          </ElSubMenu>
        </ElSubMenu>
        <ElSubMenu index="3">
          <template #title>
            <ElIcon><setting /></ElIcon>Navigator Three
          </template>
          <ElMenuItemGroup>
            <template #title>Group 1</template>
            <ElMenuItem index="3-1">Option 1</ElMenuItem>
            <ElMenuItem index="3-2">Option 2</ElMenuItem>
          </ElMenuItemGroup>
          <ElMenuItemGroup title="Group 2">
            <ElMenuItem index="3-3">Option 3</ElMenuItem>
          </ElMenuItemGroup>
          <ElSubMenu index="3-4">
            <template #title>Option 4</template>
            <ElMenuItem index="3-4-1">Option 4-1</ElMenuItem>
          </ElSubMenu>
        </ElSubMenu>
      </ElMenu>
    </ElAside>

    <ElContainer>
      <ElMain>
        <IntroMd />
      </ElMain>
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
  background-color: #fcfcfc;
  border-right: 1.5px solid hsla(210, 18%, 91%, 1);
  padding: 0;
  width: 202px;
}
.layout-container .el-menu {
  border: none;
}
.layout-container .el-menu,
.layout-container .el-sub-menu .el-menu {
  background: #fcfcfc;
}
.layout-container .el-main {
  color: var(--el-text-color-primary);
  padding: 0;
}
</style>

<style>
.layout-container .markdown-body {
  padding: 20px 40px 20px 40px;
  background-color: white;
}
</style>
