import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getDynamicModuleConfiguration } from "@vc-shell/mf-module";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Builds the Module Federation remote into <moduleRoot>/plugins/vendor-portal/,
// where the platform's GET /api/apps/vendor-portal/manifest discovers remoteEntry.js.
export default getDynamicModuleConfiguration({
  entry: "./src/modules/index.ts",
  appId: "vendor-portal",
  moduleRoot: resolve(__dirname, ".."),
  // Must match the platform manifest's remote.name, which defaults to the .NET module id.
  remoteName: "VirtoCommerce.MarketplaceQuality",
});
