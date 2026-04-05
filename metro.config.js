const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project root, and the monorepo root
const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo (so we see changes in the SDK)
config.watchFolders = [workspaceRoot];

// 2. Let Metro know where to look for package dependencies
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// 3. Force Metro to resolve 'sankofa-react-native' to the local SDK folder
config.resolver.extraNodeModules = {
  'sankofa-react-native': path.resolve(workspaceRoot, 'sdks/sankofa_sdk_react_native'),
};

module.exports = config;
