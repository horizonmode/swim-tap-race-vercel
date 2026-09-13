import "../style.css";
import { mount } from "svelte";
import PresenterApp from "./PresenterApp.svelte";

mount(PresenterApp, { target: document.getElementById("app") });
