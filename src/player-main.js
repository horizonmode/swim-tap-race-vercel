import "../style.css";
import { mount } from "svelte";
import PlayerApp from "./PlayerApp.svelte";

mount(PlayerApp, { target: document.getElementById("app") });
