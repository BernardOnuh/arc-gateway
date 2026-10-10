// dist/cjs sits inside a "type": "module" package; this marks its .js files as CommonJS.
import { writeFileSync } from "node:fs";
writeFileSync(new URL("../dist/cjs/package.json", import.meta.url), JSON.stringify({ type: "commonjs" }) + "\n");
