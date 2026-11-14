import { viteConfig } from "@halo-dev/ui-plugin-bundler-kit/vite";

// `format: auto` derives the output format from spec.requires in plugin.yaml
// (>=2.26.0 -> ESM). The bundler kit generates ui-plugin.json; never create it manually.
export default viteConfig({
  format: "auto",
});
