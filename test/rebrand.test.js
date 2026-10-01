import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync } from "node:fs";
import { createServer } from "../server.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const size = (path) => statSync(new URL(`../${path}`, import.meta.url)).size;

test("RiffTree is the installed and visible product name", () => {
  const html = read("public/index.html");
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  assert.match(html, /<title>RiffTree -/);
  assert.match(html, /aria-label="RiffTree home"/);
  assert.doesNotMatch(html, /iRig Trainer|iRigTrainer/);
  assert.equal(manifest.short_name, "RiffTree");
  assert.match(manifest.name, /^RiffTree/);
  assert.equal(manifest.theme_color, "#111b16");
});

test("transparent logo, PWA icons, and account provider icons are local assets", () => {
  for (const path of [
    "public/rifftree-logo.png", "public/rifftree-wordmark.png",
    "public/rifftree-emblem.png", "public/rifftree-icon-192.png",
    "public/rifftree-icon-512.png", "public/rifftree-maskable-512.png",
    "public/rifftree-favicon-32.png", "public/rifftree-touch-180.png",
    "public/icons/google.svg", "public/icons/facebook.svg", "public/icons/email.svg",
  ]) assert.ok(size(path) > 100, `${path} should exist`);
  const manifest = JSON.parse(read("public/manifest.webmanifest"));
  for (const icon of manifest.icons) assert.ok(size(`public${icon.src}`) > 100);
  const worker = read("public/service-worker.js");
  for (const asset of ["/rifftree-wordmark.png", "/rifftree-icon-192.png", "/icons/google.svg", "/icons/facebook.svg", "/icons/email.svg"])
    assert.ok(worker.includes(`"${asset}"`), `${asset} should be cached`);
});

test("legacy local progress identifiers stay compatible", () => {
  assert.match(read("public/profile-store.js"), /irig-demo/);
  assert.match(read("public/profile-store.js"), /irig-live/);
  assert.match(read("public/song-studio-storage.js"), /irig-song-studio/);
  assert.match(read("public/library-tools.js"), /irig-trainer-bundle/);
});

test("the local server serves PWA PNG icons with an image content type", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/rifftree-icon-192.png`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "image/png");
    assert.ok((await response.arrayBuffer()).byteLength > 100);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
