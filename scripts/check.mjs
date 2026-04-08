import { spawnSync } from "node:child_process";

const files = ["app.js", "cloud.js", "config.js", "model.js"];
let failed = false;

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    failed = true;
  } else {
    console.log(`OK  ${file}`);
  }
}

if (failed) {
  process.exit(1);
}
