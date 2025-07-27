import * as util from "./util.ts";

export type Chunks = FixedChunks | CustomChunks;
export enum ChunksType {
  Fixed = "fixed",
  Custom = "custom",
}

/** Split using chunks of fixed size. */
export type FixedChunks = {
  type: ChunksType.Fixed;
  value: number;
};

/**
 * Specify the pages for each chunk.
 *
 * @picker pdf-util/ChunksPicker {"pdf": super.super.pdf}
 */
export type CustomChunks = {
  type: ChunksType.Custom;
  value: string[];
};

/**
 * Split a single PDF into multiple PDFs.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/split(pdf = @file("baked-alaska.pdf"), chunks = /Fixed(2))
 * ```
 */
export async function split(pdf: File, chunks: Chunks): Promise<File[]> {
  const chunkPages = [];
  switch (chunks.type) {
    case ChunksType.Fixed: {
      const pageCount = await util.getPageCount(pdf);
      for (let i = 1; i <= pageCount; i += chunks.value) {
        const end = Math.min(pageCount, i + chunks.value - 1);
        if (i !== end) {
          chunkPages.push(`${i}-${end}`);
        } else {
          chunkPages.push(i.toString());
        }
      }
      break;
    }
    case ChunksType.Custom:
      for (const pages of chunks.value) {
        const sel = await util.parsePageSelection(pages, pdf);
        chunkPages.push(sel);
      }
      break;
  }

  const inputPath = util.inputPath(pdf.name);
  const worker = await util.getWorker();
  const pdfs = [];
  for (const [index, chunk] of chunkPages.entries()) {
    const outputPath = util.outputPath(inputPath, { suffix: `-${index + 1}` });
    const chunkPdf = await worker.callQpdf(
      pdf,
      ["--warning-exit-0", inputPath, "--pages", ".", chunk, "--", outputPath],
      outputPath,
    );
    pdfs.push(chunkPdf);
  }
  return pdfs;
}
