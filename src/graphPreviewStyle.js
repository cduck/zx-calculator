import { defineConfigs } from "v-network-graph";

const green = "#cfc";
const red = "#f88";
const black = "#000";
const hEdgeColor = "#08f";
const errorColor = "#fa0";

const nodeConfig = {
  type: "circle",
  radius: (n) =>
    ({
      z: 10,
      x: 10,
      boundary: 5,
      pivotA: 8,
    }[n.zxType] ?? 7.5),
  strokeWidth: (n) =>
    ({
      z: 1.5,
      x: 1.5,
      boundary: 1.5,
      pivotA: 1.5,
    }[n.zxType] ?? 1.5),
  strokeColor: (n) =>
    ({
      z: black,
      x: black,
      boundary: black,
      pivotA: hEdgeColor,
    }[n.zxType] ?? black),
  strokeDasharray: (n) =>
    ({
      z: "0",
      x: "0",
      boundary: "0",
      pivotA: "4 1.027",
    }[n.zxType] ?? "4 3.854"),
  color: (n) =>
    ({
      z: green,
      x: red,
      boundary: black,
      pivotA: "white",
    }[n.zxType] ?? errorColor),
};

const edgeConfig = {
  width: (n) =>
    ({
      normal: 1.5,
      hadamard: 1.5,
    }[n.zxType] ?? 6),
  color: (n) =>
    ({
      normal: black,
      hadamard: hEdgeColor,
    }[n.zxType] ?? errorColor),
  dasharray: (n) =>
    ({
      normal: "",
      hadamard: "4 1",
    }[n.zxType] ?? "4 2"),
  linecap: "butt",
  animate: false,
  animationSpeed: 50,
};

export const previewStyle = defineConfigs({
  // https://dash14.github.io/v-network-graph/reference.html#configurations
  view: {
    scalingObjects: true,
    panEnabled: false,
    zoomEnabled: false,
    minZoomLevel: 0.1,
    maxZoomLevel: 64,
    doubleClickZoomEnabled: false,
    mouseWheelZoomEnabled: true,
    autoPanAndZoomOnLoad: "center-content",
    autoPanOnResize: true,
    grid: {
      visible: false,
      interval: 12,
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
    },
  },
  node: {
    draggable: false,
    selectable: false,
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
  },
  edge: {
    draggable: false,
    selectable: false,
    normal: edgeConfig,
    hover: edgeConfig,
    selected: Object.assign({}, edgeConfig, {
      width: 3,
      color: (n) =>
        ({
          normal: "#940",
          hadamard: "#d80",
        }[n.zxType] ?? errorColor),
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
  },
  path: {
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
  },
});
