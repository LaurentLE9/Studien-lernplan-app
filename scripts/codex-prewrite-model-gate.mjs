export * from "./manual-prewrite-model-gate.mjs";

import { runCli } from "./manual-prewrite-model-gate.mjs";

// Legacy compatibility entrypoint. New calls use scripts/manual-prewrite-model-gate.mjs.
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exitCode = runCli();
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 2;
  }
}
