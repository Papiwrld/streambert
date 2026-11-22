const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { FileMatcher } = require("app-builder-lib/out/fileMatcher");
const { build } = require("../package.json");

test("installed builds include both window preload scripts", () => {
  const root = path.resolve(__dirname, "..");
  const include = new FileMatcher(root, root, (value) => value, build.files).createFilter();
  for (const filename of ["preload.js", "popout-preload.js"]) {
    const absolute = path.join(root, filename);
    assert.equal(include(absolute, fs.statSync(absolute)), true, filename);
  }
});
