#!/usr/bin/env node
/**
 * 版本同步脚本
 * 在 npm version 后自动执行，将版本号同步到 Cargo.toml
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

// 读取 package.json 的版本
const pkgPath = resolve(rootDir, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
const version = pkg.version;

console.log(`[sync-version] Syncing version ${version} to Cargo.toml...`);

// 更新 Cargo.toml
const cargoPath = resolve(rootDir, 'src-tauri', 'Cargo.toml');
let cargoToml = readFileSync(cargoPath, 'utf-8');

// 使用正则替换 version 行，保留其他内容
cargoToml = cargoToml.replace(
  /^version\s*=\s*"[^"]+"/m,
  `version = "${version}"`
);

writeFileSync(cargoPath, cargoToml);
console.log(`[sync-version] ✓ Cargo.toml updated to ${version}`);

// 可选：如果 Tauri 配置没使用 "../package.json"，也可以同步
// 但推荐用 "../package.json" 方式，这样不需要手动改
