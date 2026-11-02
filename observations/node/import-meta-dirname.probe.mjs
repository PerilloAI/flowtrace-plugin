/* global console, process */
// Prints what this Node gives for the two ways a module can find its folder. The page script uses the second, so it
// runs on Node 18.
//   npx -y -p node@18 node observations/node/import-meta-dirname.probe.mjs
import path from "node:path";
import { fileURLToPath } from "node:url";

console.log(JSON.stringify({
  node: process.version,
  importMetaDirname: typeof import.meta.dirname,
  fromFileUrl: typeof path.dirname(fileURLToPath(import.meta.url))
}));
