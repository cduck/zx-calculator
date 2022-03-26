import { createApp } from "vue";
// Data store
import { createPinia } from "pinia";
// v-network-graph graph manipulation library
import VNetworkGraph from "v-network-graph";
import "v-network-graph/lib/style.css";
// ElementPlus UI library
import ElementPlus from "element-plus";
import "element-plus/dist/index.css";
// App
import App from "./App.vue";

const app = createApp(App);

app.use(createPinia());
app.use(VNetworkGraph);
app.use(ElementPlus);
app.mount("#app");
