const { JsiiProject } = require('projen');

const project = new JsiiProject({
  authorName: "Neva Argueta",
  name: "custom-awscdk-app-ts",
  repository: "https://github.com/neva.argueta/custom-awscdk-app-ts.git",
  entrypoint: 'lib/index.js',
  stability: 'experimental',
  devDeps: [
    '@types/fs-extra@^8',
  ],
  deps: ['projen' ],
  peerDeps: ['projen'],
  eslint: false,
  mergify: false,
  buildWorkflow: false,
  dependabot: false,
  projenDevDependency: true,
  pullRequestTemplate: false,
  releaseWorkflow: false,
  bundledDeps: ['fs-extra'],
});

project.addScript('build', 'yarn run compile && yarn run package');

project.synth();
