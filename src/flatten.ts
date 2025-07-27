import * as util from "./util.ts";

/**
 * Collapse annotations and form fields into the contents of a PDF.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/flatten(pdf = @file("sample-rental-agreement.pdf"))
 * ```
 */
export async function flatten(
  pdf: File,
  /** @picker pdf-util/PageSelectionPicker {"pdf": super.pdf} */
  pageSelection?: string,
): Promise<File> {
  let sel = "1-z";
  if (pageSelection) {
    sel = await util.parsePageSelection(pageSelection, pdf);
  }
  const outputPath = util.outputPath(pdf.name, { suffix: "-flat" });
  const worker = await util.getWorker();
  return worker.callQpdf(
    pdf,
    [
      util.inputPath(pdf.name),
      "--pages",
      ".",
      sel,
      "--",
      outputPath,
      "--flatten-annotations=all",
    ],
    outputPath,
  );
}
