import * as util from "./util.ts";

/**
 * Extract text from a PDF.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/extract_text(pdf = @file("baked-alaska.pdf"))
 * ```
 */
export async function extractText(
  pdf: File,
  /** @picker pdf-util/PageSelectionPicker {"pdf": super.pdf} */
  pageSelection?: string,
): Promise<string[]> {
  const sel = await util.parsePageSelectionArray(pageSelection || "1..-1", pdf);
  const outputPaths = sel.map((x) => util.outputPath(`page${x}.txt`));

  const worker = await util.getWorker();
  const textFiles = await worker.callMutool(
    pdf,
    [
      "draw",
      "-o",
      util.outputPath("page%d.txt"),
      util.inputPath(pdf.name),
      sel.join(","),
    ],
    outputPaths,
  );

  const text: string[] = [];
  for (const file of textFiles as File[]) {
    text.push(await file.text());
  }
  return text;
}
