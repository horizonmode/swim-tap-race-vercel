import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { resolve } from "node:path";

export default defineConfig({
    plugins: [svelte()],
    build: {
        rollupOptions: {
            input: {
                player: resolve(process.cwd(), "index.html"),
                presenter: resolve(process.cwd(), "race.html"),
                admin: resolve(process.cwd(), "admin.html")
            }
        }
    }
});
