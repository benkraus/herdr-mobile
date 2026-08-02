const fs = require("node:fs");
const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const { withUniwindConfig } = require("uniwind/metro");

/** @type {import("expo/metro-config").MetroConfig} */
const config = getDefaultConfig(__dirname);
// This app is the workspace root after being extracted from apps/mobile.
// Keeping the original monorepo-relative path would make Metro watch all of
// the current user's home directory and apply its block list outside this project.
const workspaceRoot = __dirname;
const escapedWorkspaceRoot = workspaceRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const mobileShikiRoot = path.dirname(require.resolve("shiki/package.json", { paths: [__dirname] }));
const tablerReactNativeShim = path.join(
  __dirname,
  "src/shims/tabler-icons-react-native.js",
);
const resolveShikiDependencyRoot = (packageName) => {
  const entryPath = require.resolve(packageName, { paths: [mobileShikiRoot] });
  let currentDir = path.dirname(entryPath);

  while (!fs.existsSync(path.join(currentDir, "package.json"))) {
    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      throw new Error(`Could not resolve package root for ${packageName}`);
    }
    currentDir = parentDir;
  }

  return currentDir;
};

config.watchFolders = [...new Set([...(config.watchFolders ?? []), workspaceRoot])];
config.resolver = {
  ...config.resolver,
  // Tabler's React Native entry point re-exports the complete icon catalog.
  // Metro does not tree-shake that barrel while transforming, so importing the
  // upstream AppSymbol wrapper otherwise expands this small app to ~7,700
  // modules and tens of gigabytes of transform memory. Keep AppSymbol identical
  // to upstream and resolve only that barrel to an equivalent direct-import
  // shim; package subpath imports continue through Metro's normal resolver.
  resolveRequest: (context, moduleName, platform) => {
    if (moduleName === "@tabler/icons-react-native") {
      return { type: "sourceFile", filePath: tablerReactNativeShim };
    }

    return context.resolveRequest(context, moduleName, platform);
  },
  blockList: [
    ...(Array.isArray(config.resolver?.blockList)
      ? config.resolver.blockList
      : config.resolver?.blockList
        ? [config.resolver.blockList]
        : []),
    new RegExp(`${escapedWorkspaceRoot}[/\\\\]\\.t3[/\\\\].*`),
  ],
  extraNodeModules: {
    // oxlint-disable-next-line unicorn/no-useless-fallback-in-spread
    ...(config.resolver?.extraNodeModules ?? {}),
    shiki: mobileShikiRoot,
    "@shikijs/core": resolveShikiDependencyRoot("@shikijs/core"),
    "@shikijs/engine-javascript": resolveShikiDependencyRoot("@shikijs/engine-javascript"),
    "@shikijs/engine-oniguruma": resolveShikiDependencyRoot("@shikijs/engine-oniguruma"),
    "@shikijs/langs": resolveShikiDependencyRoot("@shikijs/langs"),
    "@shikijs/themes": resolveShikiDependencyRoot("@shikijs/themes"),
    "@shikijs/types": resolveShikiDependencyRoot("@shikijs/types"),
    "@shikijs/vscode-textmate": resolveShikiDependencyRoot("@shikijs/vscode-textmate"),
  },
};

module.exports = withUniwindConfig(config, {
  cssEntryFile: "./global.css",
  polyfills: { rem: 14 },
});
