import * as util from "./util.ts";

/**
 * Remove encryption, password protection and permissions from a PDF.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/unlock(pdf = @file("secret-ingredient.pdf"), password = "hotdog")
 * ```
 */
export async function unlock(
  pdf: File,
  /** Only required if your PDF is password-protected. */
  password?: string,
): Promise<File> {
  const outputPath = util.outputPath(pdf.name, { suffix: "-unlocked" });
  const worker = await util.getWorker();
  return worker.callQpdf(
    pdf,
    [
      "--warning-exit-0",
      util.inputPath(pdf.name),
      ...(password ? [`--password=${password}`] : []),
      "--decrypt",
      "--remove-restrictions",
      outputPath,
    ],
    outputPath,
  );
}
