import * as path from "path";
import * as fs from "fs/promises";
import esbuild from "esbuild";
import { run } from "runish";
import * as htmlBindgen from "html-bindgen";

const OUT_DIR = path.resolve("./out");
const RELEASE_DIR = path.join(OUT_DIR, "release");
const { RELEASE } = process.env;

async function main() {
  if (RELEASE) await fs.rm(OUT_DIR, { force: true, recursive: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  await htmlBindgen.bindgen({
    inputDir: "src",
    outputDir: path.join(OUT_DIR, "html"),
  });

  await esbuild.build({
    entryPoints: ["src/pagePicker/index.css", "src/editor/index.css"],
    outdir: OUT_DIR,
    outbase: "src",
    bundle: true,
    write: true,
    minify: !!RELEASE,
  });

  await fs.cp(
    "node_modules/pdfjs-dist/legacy/build/pdf.mjs",
    path.join(OUT_DIR, "pdfjs.chunk.js"),
  );
  await fs.cp(
    "node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
    path.join(OUT_DIR, "pdfjs.worker.js"),
  );
  for (const jsPath of [
    "node_modules/@jspawn/ghostscript-wasm/gs.js",
    "node_modules/qpdf-wasm/qpdf.js",
    "node_modules/mutool-wasm/mutool.js",
  ]) {
    await fs.cp(
      jsPath,
      path.join(OUT_DIR, path.basename(jsPath, ".js") + ".wasm.js"),
    );
  }
  await fs.cp(
    "node_modules/pdfcpu-wasm/index.js",
    path.join(OUT_DIR, "pdfcpu.wasm.js"),
  );
  await fs.cp("node_modules/pdf2docx-wasm", path.join(OUT_DIR, "pdf2docx"), {
    recursive: true,
  });

  await run("node_modules/typescript/bin/tsc", ["--noEmit"]);

  const workerBuild = await esbuild.build({
    entryPoints: ["src/worker.worker.ts"],
    outdir: OUT_DIR,
    bundle: true,
    write: false,
    format: "esm",
    target: "es2020",
    loader: {
      ".wasm": "file",
      ".wasm.js": "file",
      ".whl": "file",
      ".asm.js": "file",
      ".json": "file",
      ".zip": "file",
    },
    external: [
      "node:url",
      "node:fs",
      "node:fs/promises",
      "node:vm",
      "node:path",
      "node:crypto",
      "node:child_process",
    ],
    minify: !!RELEASE,
    legalComments: "none",
  });
  for (const file of workerBuild.outputFiles) {
    await fs.writeFile(
      path.join(OUT_DIR, path.basename(file.path)),
      file.contents,
    );
  }

  await esbuild.build({
    entryPoints: [
      "src/index.ts",
      "src/pickers.ts",
      ...(RELEASE ? [] : ["tests/index.ts"]),
    ],
    outdir: OUT_DIR,
    bundle: true,
    write: true,
    format: "esm",
    target: "es2020",
    loader: {
      ".wasm": "file",
      ".css": "text",
      ".worker.js": "file",
      ".chunk.js": "file",
      ".ttf": "dataurl",
    },
    external: ["path", "module", "fs", "child_process"],
    minify: !!RELEASE,
    legalComments: "none",
  });

  if (!RELEASE) return;

  await fs.rm(RELEASE_DIR, { force: true, recursive: true });
  await fs.mkdir(RELEASE_DIR, { recursive: true });

  const files = [
    "out/gs-*.wasm",
    "out/gs.wasm-*.js",
    "out/mutool-*.wasm",
    "out/mutool.wasm-*.js",
    "out/pdfcpu-*.wasm",
    "out/pdfcpu.wasm-*.js",
    "out/qpdf-*.wasm",
    "out/qpdf.wasm-*.js",
    "out/pdfjs.chunk-*.js",
    "out/pdfjs.worker-*.js",
    "out/pdf2docx",
    "out/worker.worker-*.js",
    "out/pickers.js",
    "out/index.js",
  ];
  for (const glob of files) {
    for await (const filePath of fs.glob(glob)) {
      await fs.cp(filePath, path.join(RELEASE_DIR, path.basename(filePath)), {
        recursive: true,
      });
    }
  }

  await fs.cp("assets", RELEASE_DIR, { recursive: true });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
