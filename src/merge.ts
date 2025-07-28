import * as util from "./util.ts";

export type Chunk = {
  pdf: File;
  /**
   * Optionally select only certain pages. Leave blank for all pages.
   *
   * @picker pdf-util/PageSelectionPicker {"pdf": super.pdf}
   */
  pageSelection?: string;
};

/**
 * Combine multiple PDFs into one.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/merge(
 *     chunks = [
 *         Chunk(pdf = @file("baked-alaska.pdf"), page_selection = "3"),
 *         Chunk(pdf = @file("sample-rental-agreement.pdf"), page_selection = "2,1")
 *     ]
 * )
 * ```
 */
export async function merge(chunks: Chunk[]): Promise<File> {
  if (chunks.length === 0) {
    throw "expected at least one chunk";
  }

  const inputFiles = chunks.map((x, i) => ({ name: `${i}.pdf`, data: x.pdf }));
  const pages = [];
  for (const [index, chunk] of chunks.entries()) {
    const sel = await util.parsePageSelection(
      chunk.pageSelection || "1..-1",
      chunk.pdf,
    );
    const path = util.inputPath(inputFiles[index]!.name);
    if (index === 0) {
      pages.push(path, "--pages", ".", sel);
    } else {
      pages.push(path, sel);
    }
  }

  const outputPath = util.outputPath(chunks[0].pdf.name, { suffix: "-merged" });
  const worker = await util.getWorker();
  return worker.callQpdf(
    inputFiles,
    ["--warning-exit-0", ...pages, "--", outputPath],
    outputPath,
  );
}
