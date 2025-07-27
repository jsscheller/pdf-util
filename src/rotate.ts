import * as util from "./util.ts";

/**
 * Rotate the pages in a PDF.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/rotate(pdf = @file("baked-alaska.pdf"), angle = 90, relative = true)
 * ```
 */
export async function rotate(
  pdf: File,
  /** Rotation angle in degrees. */
  angle: number,
  /** Rotate the page relative to its current rotation. */
  relative?: boolean,
  /** @picker pdf-util/PageSelectionPicker {"pdf": super.pdf} */
  pageSelection?: string,
): Promise<File> {
  const sel = await util.parsePageSelectionArray(pageSelection || "1..-1", pdf);
  const outputPath = util.outputPath(pdf.name, { suffix: "-rotate" });
  const worker = await util.getWorker();
  return worker.callQpdf(
    pdf,
    [
      util.inputPath(pdf.name),
      "--pages",
      ".",
      "1-z",
      "--",
      outputPath,
      `--rotate=${relative ? "+" : ""}${normAngle(angle)}:${sel}`,
    ],
    outputPath,
  );
}

function normAngle(deg: number): number {
  deg = deg % 360;
  if (deg < 0) deg += 360;
  return deg;
}
