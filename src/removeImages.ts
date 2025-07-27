import * as util from "./util.ts";

/**
 * Remove the images from a PDF.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/remove_images(pdf = @file("baked-alaska.pdf"))
 * ```
 */
export async function removeImages(pdf: File): Promise<File> {
  const inputPath = util.inputPath(pdf.name);
  const outputPath = util.outputPath(inputPath, { suffix: "-no-images" });
  const worker = await util.getWorker();
  return worker.callGs(
    pdf,
    ["-o", outputPath, "-sDEVICE=pdfwrite", "-dFILTERIMAGE", inputPath],
    outputPath,
  );
}
