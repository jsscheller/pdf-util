import * as serdev from "serdev";

serdev.listen({
  headers: {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  },
  components: {
    src: {
      dir: ".",
      build: "node scripts/build.js",
      watch: ["src"],
    },
    tests: {
      dir: ".",
      build: "node scripts/build.js",
      watch: ["src", "tests"],
    },
  },
  routes: {
    "/examples/*rest": (x) => `examples/${x.rest}`,
    "/assets/*rest": (x) => `assets/${x.rest}`,
    "/tests/index.html": "tests/index.html",
    "/tests/*rest": ["tests", (x) => `out/tests/${x.rest}`],
    "/*rest": ["src", (x) => `out/${x.rest}`],
  },
});
