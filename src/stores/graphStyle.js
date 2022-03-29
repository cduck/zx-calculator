import { reactive } from "vue";
import { defineStore } from "pinia";
import { defineConfigs } from "v-network-graph";

const green = "#cfc";
const red = "#f88";
const black = "#000";
const hEdgeColor = "#08f";
const errorColor = "#f00";

const nodeConfig = {
  type: "circle",
  radius: (n) =>
    ({
      z: 10,
      x: 10,
      boundary: 5,
      null: 7.5,
    }[n.zxType || null]),
  strokeWidth: (n) =>
    ({
      z: 1.5,
      x: 1.5,
      boundary: 1.5,
      null: 0,
    }[n.zxType || null]),
  strokeColor: black,
  strokeDasharray: "0",
  color: (n) =>
    ({
      z: green,
      x: red,
      boundary: black,
      null: errorColor,
    }[n.zxType || null]),
};

const edgeConfig = {
  width: (n) =>
    ({
      normal: 1.5,
      hadamard: 1.5,
      null: 6,
    }[n.zxType || null]),
  color: (n) =>
    ({
      normal: black,
      hadamard: hEdgeColor,
      null: errorColor,
    }[n.zxType || null]),
  dasharray: (n) =>
    ({
      normal: "",
      hadamard: "4 1",
      null: "4 2",
    }[n.zxType || null]),
  linecap: "butt",
  animate: false,
  animationSpeed: 50,
};

export const useStyleStore = defineStore("graphStyle", {
  state: () =>
    defineConfigs({
      // https://dash14.github.io/v-network-graph/reference.html#configurations
      view: reactive({
        scalingObjects: true,
        panEnabled: true,
        zoomEnabled: true,
        minZoomLevel: 0.1,
        maxZoomLevel: 64,
        doubleClickZoomEnabled: false,
        mouseWheelZoomEnabled: true,
        autoPanAndZoomOnLoad: "center-content",
        autoPanOnResize: true,
        grid: reactive({
          visible: true,
          interval: 12.5,
          thickIncrements: 4,
          line: {
            color: "#e0e0e0",
            width: 1,
            dasharray: 1,
          },
          think: {
            color: "#ccc",
            width: 1,
            dasharray: 0,
          },
        }),
      }),
      node: reactive({
        draggable: true,
        selectable: true,
        normal: nodeConfig,
        hover: nodeConfig,
        selected: nodeConfig,
        label: {
          visible: true,
          text: "zxAngle",
          fontFamily: undefined,
          fontSize: 11,
          lineHeight: 1.1,
          color: black,
          margin: 4,
          direction: "north",
          background: {
            visible: false,
            color: "white",
            padding: {
              vertical: 1,
              horizontal: 4,
            },
            borderRadius: 2,
          },
        },
        focusring: {
          visible: true,
          width: 3,
          padding: 2,
          color: "#eb0",
          dasharray: "0",
        },
        zOrder: {
          enabled: true,
          bringToFrontOnHover: false,
          bringToFrontOnSelected: true,
        },
      }),
      edge: reactive({
        selectable: true,
        normal: edgeConfig,
        hover: edgeConfig,
        selected: Object.assign({}, edgeConfig, {
          width: 3,
          color: (n) =>
            ({
              normal: "#940",
              hadamard: "#d80",
              null: errorColor,
            }[n.zxType || null]),
        }),
        gap: 15,
        margin: 1.5 / 2 - 4 / 2,
        type: "curve",
        summarize: false,
        zOrder: {
          enabled: true,
          bringToFrontOnHover: false,
          bringToFrontOnSelected: true,
        },
      }),
      path: reactive({
        visible: true,
        clickable: false,
        hoverable: false,
        selectable: false,
        curveInNode: true,
        //end: "edgeOfNode", // Causes crash
        //margin: 20,
        normal: {
          width: 10,
          color: "rgba(0,100,255,0.2)",
        },
      }),
      layout: reactive({
        snapToGrid: false,
        grid: 10,
        distance: 50,
        forceLayout: false,
        fixBoundaries: true,
        newNodePositionMargin: 0, // Defaults to "distance"
      }),
      extra: reactive({
        zoomLevel: 1,
      }),
    }),
});
