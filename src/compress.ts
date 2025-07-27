import * as util from "./util.ts";

/**
 * Reduce the size of a PDF.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/compress(pdf = @file("baked-alaska.pdf"))
 * ```
 */
export async function compress(pdf: File): Promise<File> {
  const worker = await util.getWorker();

  const inputPath = util.inputPath(pdf.name);
  const gsOutputPath = util.outputPath(util.inputPath(pdf.name), {
    suffix: "-gs",
  });
  const gsOutput = await worker.callGs(
    pdf,
    [
      // https://ghostscript.com/doc/current/VectorDevices.htm
      "-o",
      gsOutputPath,
      "-sDEVICE=pdfwrite",
      "-dPDFSETTINGS=/screen",
      "-dColorImageResolution=100",
      "-dGrayImageResolution=100",
      "-dMonoImageResolution=100",
      "-dCompatibilityLevel=1.4",
      "-dConvertCMYKImagesToRGB=true",
      "-c",
      "<</AlwaysEmbed [ ]>> setdistillerparams",
      "-c",
      "<</NeverEmbed [ /Courier /Courier-Bold /Courier-Oblique /Courier-BoldOblique /Helvetica /Helvetica-Bold /Helvetica-Oblique /Helvetica-BoldOblique /Times-Roman /Times-Bold /Times-Italic /Times-BoldItalic /Symbol /ZapfDingbats /Arial ]>> setdistillerparams",
      "-f",
      inputPath,
    ],
    gsOutputPath,
  );

  const outputPath = util.outputPath(pdf.name, { suffix: "-compressed" });
  return worker.callQpdf(
    gsOutput,
    [
      // https://qpdf.readthedocs.io/en/latest/cli.html
      util.inputPath(gsOutput.name),
      "--object-streams=generate",
      "--compression-level=9",
      "--recompress-flate",
      "--optimize-images",
      outputPath,
    ],
    outputPath,
  );
}
