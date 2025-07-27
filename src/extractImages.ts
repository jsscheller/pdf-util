import * as util from "./util.ts";
import type * as pdfjsT from "pdfjs-dist";
import { ImageFormat } from "./imageFormat.ts";

/**
 * Extract images from a PDF.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/extract_images(
 *     pdf = @file("baked-alaska.pdf"),
 *     format = /Jpeg(quality = 90),
 *     min_area = 2500,
 * )
 * ```
 */
export async function extractImages(
  pdf: File,
  format: ImageFormat,
  /**
   * Extract images with a width greater than or equal to `minWidth` (in
   * pixels).
   */
  minWidth?: number,
  /**
   * Only extract images with a height greater than or equal to `minHeight` (in
   * pixels).
   */
  minHeight?: number,
  /**
   * Only extract images with an area greater than or equal to `minArea` (in
   * pixels).
   */
  minArea?: number,
): Promise<File[]> {
  const buf = await pdf.arrayBuffer();
  const pdfjs = await util.loadPdfjs();
  const doc = await pdfjs.getDocument(buf).promise;

  const images: File[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    await extractImagesFromPage(
      pdfjs,
      page,
      format,
      images,
      (width, height) => {
        if (minWidth && width < minWidth) return false;
        if (minHeight && height < minHeight) return false;
        if (minArea && width * height < minArea) return false;
        return true;
      },
    );
  }
  return images;
}

async function extractImagesFromPage(
  pdfjs: typeof pdfjsT,
  page: pdfjsT.PDFPageProxy,
  format: ImageFormat,
  images: File[],
  filter: (width: number, height: number) => boolean,
) {
  const operatorList = await page.getOperatorList();
  const commonObjs = page.commonObjs;
  const objs = page.objs;

  for (let i = 0; i < operatorList.fnArray.length; i++) {
    const fn = operatorList.fnArray[i];
    const args = operatorList.argsArray[i];

    // Check for image operations (paintImageXObject, paintInlineImageXObject, etc.)
    if (fn === pdfjs.OPS.paintImageXObject) {
      const imgName = args[0];

      let imgData = null;
      if (objs.has(imgName)) {
        imgData = objs.get(imgName);
      } else if (commonObjs.has(imgName)) {
        imgData = commonObjs.get(imgName);
      }

      if (imgData && filter(imgData.width, imgData.height)) {
        const image = await processImageData(imgData, imgName, format);
        if (image) images.push(image);
      }
    } else if (fn === pdfjs.OPS.paintInlineImageXObject) {
      const imgData = args[0];
      if (filter(imgData.width, imgData.height)) {
        const image = await createImageFromData(imgData, `inline_${i}`, format);
        if (image) images.push(image);
      }
    }
  }
}

async function processImageData(
  imgData: any,
  imgName: string,
  format: ImageFormat,
): Promise<File | undefined> {
  // Check if it's already processed image data
  if (imgData) {
    return createImageFromData(imgData, imgName, format);
  }

  // If it's a promise, wait for it
  if (imgData && typeof imgData.then === "function") {
    const resolvedData = await imgData;
    return createImageFromData(resolvedData, imgName, format);
  }
}

async function createImageFromData(
  imgData: any,
  imgName: string,
  format: ImageFormat,
): Promise<File | undefined> {
  if (!imgData.data && !imgData.bitmap) {
    return;
  }

  const { width, height } = imgData;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  if (imgData.bitmap) {
    ctx.drawImage(imgData.bitmap, 0, 0);
  } else {
    const imageData = new ImageData(
      new Uint8ClampedArray(imgData.data),
      width,
      height,
    );
    ctx.putImageData(imageData, 0, 0);
  }

  return util.canvasToImage(canvas, format, imgName);
}
