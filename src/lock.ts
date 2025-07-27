import * as util from "./util.ts";

export enum Encryption {
  Aes256 = "aes256",
  Aes128 = "aes128",
}

/**
 * Encrypt a PDF.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/lock(pdf = @file("baked-alaska.pdf"), encryption = /Aes256, password = "hotdog")
 * ```
 */
export async function lock(
  pdf: File,
  /**
   * At the time of this writing, both `256-bit AES` and `128-bit AES`
   * encryption are considered secure. `256-bit AES` is stronger and should be
   * preferred. However, `256-bit AES` requires PDF version 1.7 whereas `128-bit
   * AES` requires just 1.6. Learn more about PDF encryption
   * [here](https://qpdf.readthedocs.io/en/latest/encryption.html).
   */
  encryption?: Encryption,
  /** Optionally encrypt using a password. */
  password?: string,
): Promise<File> {
  const outputPath = util.outputPath(pdf.name, { suffix: "-locked" });
  password ||= "";
  const worker = await util.getWorker();
  return worker.callQpdf(
    pdf,
    [
      "--warning-exit-0",
      util.inputPath(pdf.name),
      "--encrypt",
      password,
      password,
      encryption === Encryption.Aes128 ? "128" : "256",
      "--",
      outputPath,
    ],
    outputPath,
  );
}
