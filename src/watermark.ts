import * as util from "./util.ts";

/**
 * Add a watermark to a PDF.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/watermark(
 *     pdf = @file("baked-alaska.pdf"),
 *     text = "DRAFT",
 *     font_size = 48,
 * )
 * ```
 */
export async function watermark(
  pdf: File,
  text: string,
  /** @default 24 */
  fontSize?: number,
  /** @default "Helvetica" */
  font?: string,
  /**
   * @default "#000000"
   * @picker color
   */
  color?: string,
  /**
   * @default 0.5
   * @picker range {"min": 0, "max": 1, "step": 0.01}
   */
  opacity?: number,
  /** @picker pdf-util/PageSelectionPicker {"pdf": super.pdf} */
  pageSelection?: string,
): Promise<File> {
  let sel;
  if (pageSelection) {
    sel = await util.parsePageSelectionArray(pageSelection, pdf);
  }

  const worker = await util.getWorker();
  const outputPath = util.outputPath(pdf.name, { suffix: "-watermark" });
  const props = [
    `fontname:${font || "Helvetica"}`,
    `points:${fontSize || 24}`,
    `fillcolor:${color || "#000000"}`,
    `opacity:${opacity || 0.5}`,
    "scale:1",
  ];
  return worker.callPdfcpu(
    pdf,
    [
      "watermark",
      "add",
      ...(sel ? ["-p", sel.join(",")] : []),
      "-mode",
      "text",
      "--",
      text,
      props.join(", "),
      util.inputPath(pdf.name),
      outputPath,
    ],
    outputPath,
  );
}
