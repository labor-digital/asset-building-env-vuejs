import Vue from "vue";
import Main from "./Main.vue";

console.log("[DEMO: Environment distinction]", process.env.VUE_ENV);

const app = new Vue({
	render: h => h(Main)
});

export default () => app;

if (process.env.VUE_ENV === "client")
	app.$mount("#app");