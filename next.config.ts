import type { NextConfig } from "next";

/**
 * Production builds target GitHub Pages at `https://<user>.github.io/dhw-calculator/`,
 * which requires:
 *   - `output: "export"` to produce a static `out/` folder
 *   - `basePath: "/dhw-calculator"` because GH Pages serves from a subpath
 *   - `trailingSlash: true` so routes resolve as directory `index.html` files
 *   - `images.unoptimized: true` because the Next image optimizer needs a runtime
 *
 * Local dev (`NODE_ENV !== "production"`) skips the basePath so `localhost:3000/`
 * still works without prefixing every URL.
 */
const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/dhw-calculator" : "",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
