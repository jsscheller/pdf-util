import * as util from "./util.ts";

/**
 * Image to PDF conversion.
 *
 * - Supported image formats: JPG, PNG, WEBP, TIFF
 * - Each image becomes a page in the resulting PDF.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/image_to_pdf(images = [@file("banana.jpg"), @file("hotdog.png")])
 * ```
 */
export async function imageToPdf(images: File[]): Promise<File> {
  if (images.length === 0) throw new Error("expected at least one image");

  const blobs: { name: string; data: Blob }[] = images.map((x, i) => ({
    name: `${i}_${x.name}`,
    data: x,
  }));
  const outputPath = util.outputPath(images[0]!.name, { ext: "pdf" });
  const worker = await util.getWorker();
  return worker.callPdfcpu(
    blobs,
    ["import", "--", outputPath, ...blobs.map((x) => util.inputPath(x.name))],
    outputPath,
  );
}
