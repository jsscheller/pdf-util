import * as util from "./util.ts";
import { ImageFormat } from "./imageFormat.ts";

/**
 * PDF to image conversion.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/pdf_to_image(pdf = @file("baked-alaska.pdf"), format = /Jpeg(quality = 90))
 * ```
 */
export async function pdfToImage(
  pdf: File,
  format: ImageFormat,
  /** Optionally specify the pages to render - all pages are rendered by default. */
  pageSelection?: string,
  /**
   * Dots-per-inch: a higher value results in larger images.
   *
   * @default 300
   */
  dpi?: number,
): Promise<File[]> {
  const pdfjs = await util.loadPdfjs();
  const buf = await pdf.arrayBuffer();
  const doc = await pdfjs.getDocument(buf).promise;

  const canvas = document.createElement("canvas");

  const sel = await util.parsePageSelectionArray(
    pageSelection || "1..-1",
    doc.numPages,
  );

  const images: File[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    if (!sel.includes(i)) continue;

    const page = await doc.getPage(i);
    const scale = (dpi || 300) / 96;
    const viewport = page.getViewport({ scale });

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const cx = canvas.getContext("2d")!;
    await page.render({ canvasContext: cx, viewport }).promise;
    const name = util.addSuffix(pdf.name, `-${i}`);
    images.push(await util.canvasToImage(canvas, format, name));
  }
  return images;
}
