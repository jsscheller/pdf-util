import * as util from "./util.ts";

/**
 * Remove and reorder the pages in a PDF.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/repage(pdf = @file("baked-alaska.pdf"), page_selection = "3,1,2")
 * ```
 */
export async function repage(
  pdf: File,
  /**
   * Specify the order/selection of the pages.
   *
   * @picker pdf-util/PageSelectionPicker {"pdf": super.pdf}
   */
  pageSelection: string,
): Promise<File> {
  pageSelection = await util.parsePageSelection(pageSelection, pdf);
  const outputPath = util.outputPath(pdf.name, { suffix: "-repage" });
  const worker = await util.getWorker();
  return worker.callQpdf(
    pdf,
    [
      "--warning-exit-0",
      util.inputPath(pdf.name),
      "--pages",
      ".",
      pageSelection,
      "--",
      outputPath,
    ],
    outputPath,
  );
}
