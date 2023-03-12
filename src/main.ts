import { createApp } from "vue";
import "./style.css";
import AntDemo from "./AntDemo.vue";

// Vuetify
import "vuetify/styles";
import { createVuetify } from "vuetify";
import * as components from "vuetify/components";
import * as directives from "vuetify/directives";

const vuetify = createVuetify({
  components,
  directives,
});

createApp(AntDemo).use(vuetify).mount("#app");
