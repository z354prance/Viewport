const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

test("inline browser script has valid JavaScript syntax", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "src", "public", "index.html"),
    "utf8"
  );
  const match = html.match(/<script>([\s\S]*?)<\/script>/);

  assert.ok(match, "expected an inline script");
  assert.doesNotThrow(() => new Function(match[1]));
});
