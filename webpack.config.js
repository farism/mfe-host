const { WebpackManifestPlugin } = require("webpack-manifest-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const ModuleFederationPlugin =
  require("webpack").container.ModuleFederationPlugin;
const path = require("path");
const pkg = require("./package.json");
const name = pkg.name;

const mfe = {
  name,
  paths: ["/"],
};

module.exports = {
  entry: "./src/index",
  mode: "development",
  target: "web",
  devServer: {
    historyApiFallback: true,
    contentBase: path.join(__dirname, "dist"),
    port: 3000,
  },
  output: {
    filename: "bundle.[contenthash].js",
    chunkFilename: "[id].[chunkhash].js",
    path: path.resolve("dist"),
    publicPath: "/",
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        loader: "babel-loader",
        exclude: /node_modules/,
        options: {
          presets: ["@babel/preset-react"],
        },
      },
      {
        test: /\.s?[ac]ss$/i,
        use: ["style-loader", "css-loader", "sass-loader"],
      },
    ],
  },
  plugins: [
    new WebpackManifestPlugin({
      generate: (seed, files, entries) => {
        return {
          ...mfe,
          files: files.reduce(
            (acc, cur) => ({ ...acc, [cur.name]: cur.path }),
            {}
          ),
        };
      },
    }),
    new ModuleFederationPlugin({
      name: "host",
      // adds react as shared module
      // version is inferred from package.json
      // there is no version check for the required version
      // so it will always use the higher version found
      shared: {
        react: {
          import: "react", // the "react" package will be used a provided and fallback module
          shareKey: "react", // under this name the shared module will be placed in the share scope
          shareScope: "default", // share scope with this name will be used
          singleton: true, // only a single version of the shared module is allowed
        },
        "react-dom": {
          singleton: true, // only a single version of the shared module is allowed
        },
      },
    }),
    new HtmlWebpackPlugin({
      template: "./src/index.html",
    }),
  ],
};
