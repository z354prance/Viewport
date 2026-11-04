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

test("interface exposes the primary testing controls and live status", () => {
  const html = fs.readFileSync(
    path.join(__dirname, "..", "src", "public", "index.html"),
    "utf8"
  );

  for (const id of [
    "url",
    "go",
    "device-profile",
    "rotate",
    "browser",
    "header-connection",
    "status-detail"
  ]) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }

  assert.match(html, /@media \(max-width: 700px\)/);
  assert.match(html, /@media \(prefers-reduced-motion: reduce\)/);
});
