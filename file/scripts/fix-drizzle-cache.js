/**
 * Fixes missing cache/core files in drizzle-orm 0.45.x
 * This is a known packaging bug where the cache/core directory is empty.
 * Run automatically via postinstall.
 */
const fs = require('fs');
const path = require('path');

const cacheDir = path.join(__dirname, '..', 'node_modules', 'drizzle-orm', 'cache', 'core');

if (!fs.existsSync(cacheDir)) {
  fs.mkdirSync(cacheDir, { recursive: true });
}

const indexJs = path.join(cacheDir, 'index.js');
if (!fs.existsSync(indexJs) || fs.statSync(indexJs).size === 0) {
  console.log('[fix-drizzle-cache] Creating missing drizzle-orm cache/core stubs...');

  const esmContent = `import { entityKind } from "../../entity.js";
class Cache {
  static [entityKind] = "Cache";
  strategy() { return "explicit"; }
  async get() { return undefined; }
  async put() {}
  async onMutate() {}
}
class NoopCache extends Cache {
  static [entityKind] = "NoopCache";
}
async function hashQuery(sql, params) {
  const str = sql + JSON.stringify(params);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 'q_' + Math.abs(hash).toString(36);
}
export { Cache, NoopCache, hashQuery };
`;

  const cjsContent = `"use strict";
const { entityKind } = require("../../entity.cjs");
class Cache {
  static [entityKind] = "Cache";
  strategy() { return "explicit"; }
  async get() { return undefined; }
  async put() {}
  async onMutate() {}
}
class NoopCache extends Cache {
  static [entityKind] = "NoopCache";
}
async function hashQuery(sql, params) {
  const str = sql + JSON.stringify(params);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return 'q_' + Math.abs(hash).toString(36);
}
module.exports = { Cache, NoopCache, hashQuery };
`;

  fs.writeFileSync(path.join(cacheDir, 'cache.js'), esmContent);
  fs.writeFileSync(path.join(cacheDir, 'index.js'), 'export { Cache, NoopCache, hashQuery } from "./cache.js";\n');
  fs.writeFileSync(path.join(cacheDir, 'cache.cjs'), cjsContent);
  fs.writeFileSync(path.join(cacheDir, 'index.cjs'), '"use strict";\nmodule.exports = require("./cache.cjs");\n');

  console.log('[fix-drizzle-cache] Done.');
} else {
  console.log('[fix-drizzle-cache] cache/core files already exist, skipping.');
}
