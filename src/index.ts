import * as path from 'path';
import * as fs from 'fs-extra';
import { Component, AwsCdkTypeScriptApp, AwsCdkTypeScriptAppOptions, StartEntryCategory, JsonFile, TextFile } from 'projen';

export interface CustomAwsCdkTypeScriptAppOptions extends AwsCdkTypeScriptAppOptions {
  readonly husky: boolean;
}

export class CustomAwsCdkTypeScriptApp extends AwsCdkTypeScriptApp {
  constructor(options: CustomAwsCdkTypeScriptAppOptions) {
    super({ ...options, sampleCode: false });


    if (options.husky ?? true) {
      this.addDevDeps('husky@^4.2.5');
      this.addFields({
        husky: {
          hooks: {
            'pre-commit': 'npm run eslint'
          }
        }
      });
    }

    delete this.manifest.jest;

    this.addDevDeps(
      '@types/config@0.0.36',
      'webpack@^4.44.1',
      '@types/webpack@^4.41.21',
      'webpack-cli@^3.3.12',
      'ts-loader@^8.0.3',
      'prettier@^2.1.1',
      'eslint-config-prettier@^6.11.0',
      'eslint-plugin-prettier@^3.1.4',
    );
    this.addCdkDependency(
      '@aws-cdk/core',
      '@aws-cdk/aws-lambda',
    );

    this.addScript('deploy', "npm run build && cdk deploy", {
      startDesc: 'Deploys your cdk app to the AWS cloud',
      startCategory: StartEntryCategory.RELEASE,
    });

    this.addScript('build', 'webpack');
    this.addScript('eslint', 'eslint . --ext=.js,.ts --ext=.json');
    this.addScript('test', 'jest --silent --coverage');

    if (options.sampleCode ?? true) {
      new SampleCode(this);
    }

    new WebpackConfig(this);
    new JestConfig(this);

    new JsonFile(this, '.eslintrc.json', { obj:
      {
        env: { node: true },
        root: true,
        parser: '@typescript-eslint/parser',
        plugins: ['@typescript-eslint'],
        extends: [
          'eslint:recommended',
          'plugin:@typescript-eslint/recommended',
          'prettier/@typescript-eslint',
          'plugin:prettier/recommended',
        ],
      }
    });
    new TextFile(this, '.eslintignore', { lines: [
      '*.d.ts',
      'build',
      'coverage',
      'cdk.out',
    ]});
    new JsonFile(this, '.prettierrc.json', { obj:
      {
        semi: true,
        trailingComma: 'all',
        singleQuote: true,
        printWidth: 120,
        tabWidth: 2,
      }
    });
  }

}

class JestConfig extends Component {
  constructor(project: CustomAwsCdkTypeScriptApp) {
    super(project);
  }

  public synthesize(outdir: string) {
    const jestConfigFile = 'jest.config.js';
    const jestConfigDir = path.join(outdir, jestConfigFile);
    if (fs.existsSync(jestConfigDir)) {
      return;
    }

    const jestConfigCode = `module.exports = {
  roots: ['<rootDir>'],
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  transform: {
    '^.+\\.tsx?$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.ts', '!**/*.d.ts', '!cdk.out/**/*', '!bin/**/*', '!webpack.config.ts'],
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
    },
  },
  setupFilesAfterEnv: ['./jest.setup.ts'],
  };
`;

    fs.writeFileSync(jestConfigDir, jestConfigCode);


    const jestSetupCode = `process.on('unhandledRejection', (reason) => {
  console.error('Jest has found an unhandled exception!');
  fail(reason);
});
`;

    const jestSetupFile = 'jest.setup.ts';
    const jestSetupDir = path.join(outdir, jestSetupFile);
    fs.writeFileSync(jestSetupDir, jestSetupCode);
  }
}

class WebpackConfig extends Component {
  constructor(project: CustomAwsCdkTypeScriptApp) {
    super(project);
  }

  public synthesize(outdir: string) {
    const webpackConfigFile = 'webpack.config.ts';
    const webpackConfigDir = path.join(outdir, webpackConfigFile);
    if (fs.existsSync(webpackConfigDir)) {
      return;
    }

    const webpackConfigCode = `import { resolve } from 'path';
import { Configuration } from 'webpack';

const config: Configuration = {
  entry: {
    ['my-lambda/index']: './src/lambda/my-lambda.ts',
  },
  // Open question on whether to set aws-sdk to external.
  // Doing so reduces the bundle size, but theburningmonk says cold start times are actually better when you include it.
  output: {
    filename: '[name].js',
    libraryTarget: 'commonjs2',
    path: resolve(__dirname, 'build'),
  },
  // Set to 'development' for debugging purposes if needed.
  mode: 'production',
  module: {
    rules: [{ test: /\.ts$/, loader: 'ts-loader' }],
  },
  resolve: {
    extensions: ['.js', '.ts'],
  },
  target: 'node',
};

export default config;
    `;

    fs.writeFileSync(webpackConfigDir, webpackConfigCode);
  }
}

class SampleCode extends Component {
  private readonly appProject: CustomAwsCdkTypeScriptApp;
  constructor(project: CustomAwsCdkTypeScriptApp) {
    super(project);
    this.appProject = project;
  }

  public synthesize(outdir: string) {
    const srcdir = path.join(outdir, this.appProject.srcdir);
    if (fs.pathExistsSync(srcdir) && fs.readdirSync(srcdir).filter(x => x.endsWith('.ts'))) {
      return;
    }

    const srcCode = `import { App } from '@aws-cdk/core';
import { MyStack } from './my-stack';

const app = new App();
new MyStack(app, 'MyStack', {
  stackName: 'mystack-sandbox',
  description: 'Testing with projen',
  env: {
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT,
  },
});

app.synth();
    `;
    const stackCode = `import { Construct, Stack, StackProps } from '@aws-cdk/core';
import { AssetCode, Function, Runtime } from '@aws-cdk/aws-lambda';
import config from 'config';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const myLambdaFunction = new Function(this, 'SsMyLambdaFunction', {
      code: new AssetCode(__dirname + '/../build/my-lambda'),
      handler: 'index.handler',
      runtime: Runtime.NODEJS_12_X,
    });
  }
}
    `;
    const lambdaCode = `export const handler = async (): Promise<void> => {
  console.log('my-lambda has run');
};`;
    const testStackCode = `import '@aws-cdk/assert/jest';
import { MyStack } from '../src/my-stack'
import { App } from '@aws-cdk/core';

describe('My Stack', () => {
  const app = new App();
  const stack = new MyStack(app, 'test');

  test('Entire Stack', () => {
    expect(stack).not.toHaveResource('AWS::S3::Bucket');
    expect(app.synth().getStackArtifact(stack.artifactId).template).toMatchSnapshot();
  });
});`;

    fs.mkdirpSync(srcdir);
    fs.writeFileSync(path.join(srcdir, this.appProject.appEntrypoint), srcCode);
    fs.writeFileSync(path.join(srcdir, 'my-stack.ts'), stackCode);
    fs.writeFileSync(path.join(srcdir, 'my-stack.spec.ts'), testStackCode);


    const lambdaDir = path.join(outdir, this.appProject.srcdir, 'lambda');
    fs.mkdirpSync(lambdaDir);
    fs.writeFileSync(path.join(lambdaDir, 'my-lambda.ts'), lambdaCode);
  }
}
