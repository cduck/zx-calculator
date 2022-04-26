import { reactive } from "vue";
import { defineStore } from "pinia";
import { defineConfigs } from "v-network-graph";

//const green = "#cfc";
//const red = "#f88";
//const black = "#000";
//const white = "#fff";
//const hEdgeColor = "#08f";
//const errorColor = "#fa0";
//const selNEdgeColor = "#940";
//const selHEdgeColor = "#d80";
const greenOp = (opacity) => `rgba(204, 255, 204, ${opacity})`;
const redOp = (opacity) => `rgba(255, 136, 136, ${opacity})`;
const blackOp = (opacity) => `rgba(0, 0, 0, ${opacity})`;
const whiteOp = (opacity) => `rgba(255, 255, 255, ${opacity})`;
const hEdgeColorOp = (opacity) => `rgba(0, 136, 255, ${opacity})`;
const errorColorOp = (opacity) => `rgba(255, 170, 0, ${opacity})`;
const selNEdgeColorOp = (opacity) => `rgba(153, 68, 0, ${opacity})`;
const selHEdgeColorOp = (opacity) => `rgba(221, 136, 0, ${opacity})`;

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
    ((
      {
        z: blackOp,
        x: blackOp,
        boundary: blackOp,
        pivotA: hEdgeColorOp,
      }[n.zxType] ?? blackOp
    )(n.opacity ?? 1)),
  strokeDasharray: (n) =>
    ({
      z: "0",
      x: "0",
      boundary: "0",
      pivotA: "4 1.027",
    }[n.zxType] ?? "4 3.854"),
  color: (n) =>
    ((
      {
        z: greenOp,
        x: redOp,
        boundary: blackOp,
        pivotA: whiteOp,
      }[n.zxType] ?? errorColorOp
    )(n.opacity ?? 1)),
};

const edgeConfig = {
  width: (n) =>
    ({
      normal: 1.5,
      hadamard: 1.5,
    }[n.zxType] ?? 6),
  color: (n) =>
    ((
      {
        normal: blackOp,
        hadamard: hEdgeColorOp,
      }[n.zxType] ?? errorColorOp
    )(n.opacity ?? 1)),
  dasharray: (n) =>
    ({
      normal: "",
      hadamard: "4 1",
    }[n.zxType] ?? "4 2"),
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
        }),
      }),
      node: reactive({
        draggable: (n) => !n.animateOut,
        selectable: false, // Selection manually controlled through events
        normal: nodeConfig,
        hover: nodeConfig,
        selected: nodeConfig,
        label: {
          visible: true,
          text: "zxAngle",
          fontFamily: undefined,
          fontSize: 11,
          lineHeight: 1.1,
          color: (n) => blackOp(n.labelOpacity ?? n.opacity ?? 1),
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
        selectable: false, // Selection manually controlled through events
        normal: edgeConfig,
        hover: edgeConfig,
        selected: Object.assign({}, edgeConfig, {
          width: 3,
          color: (n) =>
            ((
              {
                normal: selNEdgeColorOp,
                hadamard: selHEdgeColorOp,
              }[n.zxType] ?? errorColorOp
            )(n.opacity ?? 1)),
        }),
        gap: 15,
        margin: null,
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
        grid: 12,
        distance: 12 * 4,
        newNodePositionMargin: 0, // Defaults to "distance"
        forceLayout: false,
        fixBoundaries: true,
        positionFixedByClickWithAltKey: false, // Doesn't really work yet
        animDuration: 500, // Milliseconds
      }),
      extra: reactive({
        zoomLevel: 1,
      }),
    }),
});
