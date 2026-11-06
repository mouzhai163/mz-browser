const { execSync } = require("child_process");

const env = process.env.ENV_NAME || "production";
console.log(`Building frontend with mode: ${env}`);

// Ensure Slotkit generated imports exist for Vite build (CI/build machines won't have them).
// This generates: src/core/plugin/loader/plugin-imports.generated.ts
execSync(`pnpm run generate-imports`, { stdio: "inherit" });

execSync(`pnpm run build:${env}`, { stdio: "inherit" });
