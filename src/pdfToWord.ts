import * as util from "./util.ts";

/**
 * PDF to Word conversion.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/pdf_to_word(pdf = @file("baked-alaska.pdf"))
 * ```
 */
export async function pdfToWord(
  pdf: File,
  /** @picker pdf-util/PageSelectionPicker {"pdf": super.pdf} */
  pageSelection?: string,
): Promise<File> {
  let sel;
  if (pageSelection) {
    sel = await util.parsePageSelectionArray(pageSelection, pdf);
    sel = sel.map((x) => x - 1);
  }
  const worker = await util.getWorker();
  return worker.callPdf2Docx(pdf, util.replaceExt(pdf.name, "docx"), sel);
}
