import "maplibre-gl/dist/maplibre-gl.css";
import "./styles.css";
import { App } from "./app/App";

const appRoot = document.querySelector<HTMLDivElement>("#app");

if (!appRoot) {
  throw new Error("#app root element is missing");
}

new App(appRoot).mount();
