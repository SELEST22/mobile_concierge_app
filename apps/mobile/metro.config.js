// Metro config so the Expo app can import the shared package
// (@concierge/shared) straight from the monorepo's packages/shared/src.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');
const sharedRoot = path.resolve(workspaceRoot, 'packages/shared');

const config = getDefaultConfig(projectRoot);

// Watch the shared package so edits hot-reload.
config.watchFolders = [sharedRoot];

// Resolve the bare specifier "@concierge/shared" to its TS source.
config.resolver.extraNodeModules = {
  '@concierge/shared': sharedRoot,
};

// Look for packages in the app's own node_modules first.
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];

module.exports = config;
