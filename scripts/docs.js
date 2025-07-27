import * as path from "path";
import * as fs from "fs/promises";
import { run } from "runish";
import { remark } from "remark";
import remarkToc from "remark-toc";

const OUT_DIR = path.resolve("./out");

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  await run("node_modules/typedoc/bin/typedoc", [
    "--entryPoints",
    "src/index.ts",
    "--plugin",
    "typedoc-plugin-markdown",
    "--readme",
    "none",
    "--mergeReadme",
    "true",
    "--hideBreadcrumbs",
    "true",
    "--enumMembersFormat",
    "table",
    "--parametersFormat",
    "table",
    "--propertiesFormat",
    "table",
    "--typeDeclarationFormat",
    "table",
    "--indexFormat",
    "table",
    "--outputFileStrategy",
    "modules",
    "--useCodeBlocks",
    "true",
    "--hidePageHeader",
    "true",
    "--hidePageTitle",
    "true",
    "--out",
    path.join(OUT_DIR, "docs"),
  ]);

  let md = await fs
    .readFile(path.join(OUT_DIR, "docs/README.md"))
    .then((x) => x.toString());

  while (true) {
    const start = md.indexOf("\n\n# Examples");
    if (start === -1) break;
    const end = md.indexOf("```\n", start);
    md = md.slice(0, start) + md.slice(end + 4);
  }
  while (true) {
    const start = md.indexOf("\n\n#### Preview");
    if (start === -1) break;
    const end = md.indexOf("\n", md.indexOf("\n\n", start + 2) + 2);
    md = md.slice(0, start) + md.slice(end + 1);
  }

  md = "## API\n\n" + md;

  let api = await remark()
    .use(remarkToc, {
      heading: "API",
      maxDepth: 3,
    })
    .process(md);
  api = String(api).replace("## API\n\n", () => "# API\n\n");
  await fs.writeFile("API.md", api);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
