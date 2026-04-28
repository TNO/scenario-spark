import { config } from 'dotenv';
import { resolve } from 'path';
import {
  type Configuration,
  CopyRspackPlugin,
  DefinePlugin,
  HtmlRspackPlugin,
  SwcJsMinimizerRspackPlugin,
  LightningCssMinimizerRspackPlugin,
} from '@rspack/core';

config();

const devMode = (process.env as any).NODE_ENV === 'development';
const isProduction = !devMode;
const outputPath = resolve(process.cwd(), devMode ? 'dist' : './docs');

const SERVER = process.env.SERVER;
// const publicPath = isProduction
//   ? 'https://github.io/Maplibre GUI for population simulator/popsicle'
//   : '';
const APP_PORT = 8339;

console.log(
  `Running in ${
    isProduction ? 'production' : 'development'
  } mode, serving from ${SERVER}, output directed to ${outputPath}.`
);

const configuration: Configuration = {
  experiments: {
    css: true,
    // asyncWebAssembly: true,
  },
  mode: isProduction ? 'production' : 'development',
  devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',
  entry: {
    main: './src/app.ts',
  },
  devServer: {
    port: APP_PORT,
  },
  plugins: [
    new DefinePlugin({
      // 'process.env.NODE_ENV': "'development'",
      // 'process.env.SERVER': isProduction
      //   ? `'${publicPath}'`
      //   : "'http://localhost:4545'",
    }),
    new HtmlRspackPlugin({
      title: 'Scenario Spark',
      publicPath: devMode ? undefined : 'https://tno.github.io/scenario-spark',
      minify: !devMode,
      favicon: './src/favicon.ico',
      template: './src/index.html',
    }),
    new CopyRspackPlugin({
      patterns: [
        { from: 'public', to: '.' },
      ],
    }),
    new LightningCssMinimizerRspackPlugin({
      removeUnusedLocalIdents: true,
      // minimizerOptions: {}
    }),
    new SwcJsMinimizerRspackPlugin({
      minimizerOptions: devMode
        ? {
            compress: false,
            minify: false,
            mangle: false,
          }
        : {
            compress: true,
            minify: true,
            // mangle: true,
          },
    }),
  ],
  resolve: {
    extensions: ['...', '.ts', '*.wasm', '*.csv', '*.json'], // "..." means to extend from the default extensions
    alias: {
      'osm-polygon-features': resolve(__dirname, 'src/utils/osm-polygon-features.js'),
    },
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        type: 'css',
        sideEffects: true,
      },
      {
        test: /\.ts$/,
        exclude: [/node_modules/],
        loader: 'builtin:swc-loader',
        options: {
          jsc: {
            parser: {
              syntax: 'typescript',
            },
          },
        },
        type: 'javascript/auto',
      },
      {
        test: /\.css$/,
        type: 'css',
      },
      {
        test: /\.(png|svg|jpg|jpeg|gif|webp)$/i,
        type: 'asset/resource',
      },
      {
        test: /\.(woff|woff2|eot|ttf|otf)$/i,
        type: 'asset/resource',
      },
      {
        test: /^BUILD_ID$/,
        type: 'asset/source',
      },
    ],
  },
  output: {
    filename: 'main.js',
    // filename: '[id].bundle.js',
    // publicPath,
    path: outputPath,
  },
};

export default configuration;
