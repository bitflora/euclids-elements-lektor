import fs from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import lektorContent from "./plugins/lektor";

// geomlib ships a plain browser script (`var geomlib = …`), not an ES module,
// so it is served as /vendor/geomlib.js and loaded with a <script> tag.
function geomlibVendor(): Plugin {
  const src = path.resolve(__dirname, "node_modules/@brownnrl/geomlib/dist/bundle.js");
  return {
    name: "geomlib-vendor",
    configureServer(server) {
      server.middlewares.use("/vendor/geomlib.js", (_req, res) => {
        res.setHeader("Content-Type", "text/javascript");
        res.end(fs.readFileSync(src));
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "vendor/geomlib.js", source: fs.readFileSync(src) });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [
    react(),
    geomlibVendor(),
    lektorContent({ contentRoot: path.resolve(__dirname, "../content"), books: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] }),
  ],
  server: { port: 5199, strictPort: true },
  preview: { port: 5198, strictPort: true },
  // One chunk is fine for a local reader: most of it is the text itself.
  build: { chunkSizeWarningLimit: 2000 },
  test: { environment: "node" },
});
