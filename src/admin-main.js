import "./styles/app.css";
import { mount } from "svelte";
import AdminApp from "./AdminApp.svelte";

mount(AdminApp, { target: document.getElementById("app") });
