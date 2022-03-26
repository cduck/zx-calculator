import { createApp } from "vue";
// v-network-graph graph manipulation library
import VNetworkGraph from "v-network-graph";
import "v-network-graph/lib/style.css";
// ElementPlus UI library
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
// App
import App from "./App.vue";

const app = createApp(App);

app.use(VNetworkGraph);
app.use(ElementPlus);
app.mount("#app");
