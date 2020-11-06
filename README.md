# Custom AWS CDK App

This project is testing out the external modules feature in [projen](https://github.com/eladb/projen#projects-in-external-modules). It will setup a aws cdk project with a test stack and lambda function using webpack bundler and other features.

## How to Run

To run it all locally, clone the repo and run `yarn link` so projen uses your local version instead of looking in the yarn registry. To create your `.jsii` file (projen uses that to find the project and it's metadata), run `yarn build`. If you make any modifications to `src/index.js`, run `yarn run build` again so the `.jsii` file gets updated.
Create a new folder to store your new project. First, run `yarn link 'custom-awscdk-app-ts'` so projen looks for your local version. Then, run `npx projen new --from custom-awscdk-app-ts@link:1.0.0` to generate your sample project.
