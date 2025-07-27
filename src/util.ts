import * as comlink from "comlink";
import type { WorkerThread } from "./worker.worker.ts";
import workerUrl from "out/worker.worker.js";
import pdfjsUrl from "out/pdfjs.chunk.js";
import pdfjsWorkerUrl from "out/pdfjs.worker.js";
import type * as pdfjsT from "pdfjs-dist";
import { ImageFormat, ImageFormatType } from "./imageFormat.ts";

let pdfjsPromise: Promise<typeof pdfjsT> | undefined;
let WORKER: comlink.Remote<WorkerThread> | undefined;

export async function getWorker(): Promise<comlink.Remote<WorkerThread>> {
  if (!WORKER) {
    const Wrapped = comlink.wrap(
      new Worker(new URL(workerUrl, import.meta.url).href, { type: "module" }),
    ) as any;
    WORKER = await new Wrapped();
  }
  return WORKER!;
}

export function loadPdfjs(): Promise<typeof pdfjsT> {
  if (pdfjsPromise) return pdfjsPromise;
  return (pdfjsPromise = new Promise(async (resolve) => {
    const pdfjs = (await import(
      new URL(pdfjsUrl, import.meta.url).href
    )) as typeof pdfjsT;
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      pdfjsWorkerUrl,
      import.meta.url,
    ).href;
    resolve(pdfjs);
  }));
}

export function inputPath(path: string): string {
  const name = path.split("/").at(-1)!;
  return `/input/${name}`;
}

export function outputPath(
  path: string,
  opts: { ext?: string; suffix?: string } = {},
): string {
  let name = path.split("/").at(-1)!;
  if (opts.ext) {
    name = replaceExt(name, opts.ext);
  }
  if (opts.suffix) {
    name = addSuffix(name, opts.suffix);
  }
  return `/output/${name}`;
}

export function replaceExt(name: string, ext: string): string {
  let lastDot = name.lastIndexOf(".");
  if (lastDot === -1) {
    lastDot = name.length - 1;
    ext = "." + ext;
  }
  return name.slice(0, lastDot + 1) + ext;
}

export function addSuffix(name: string, suffix: string): string {
  let stem = name;
  let ext = "";
  const lastDot = name.lastIndexOf(".");
  if (lastDot > -1) {
    stem = name.slice(0, lastDot);
    ext = name.slice(lastDot);
  }
  return `${stem}${suffix}${ext}`;
}

export async function parsePageSelection(
  s: string,
  pdf: File,
): Promise<string> {
  const sel = await parsePageSelectionArray(s, pdf);
  return sel.join(",");
}

export async function parsePageSelectionArray(
  s: string,
  pdfOrPageCount: File | number,
): Promise<number[]> {
  const dotdot = "..";
  let pageCount: number;
  if (typeof pdfOrPageCount === "number") pageCount = pdfOrPageCount;
  const getCachedPageCount = async () => {
    if (pageCount != null) return pageCount;
    return (pageCount = await getPageCount(pdfOrPageCount as File));
  };
  try {
    const segs = s.split(",").map((x) => x.trim());
    let parsed = [];
    for (const seg of segs) {
      if (seg.includes(dotdot)) {
        const split = seg.split(dotdot);
        const startRaw = seg.startsWith(dotdot) ? "1" : split[0];
        const start = await parsePageNumber(startRaw, getCachedPageCount);
        const endRaw = seg.endsWith(dotdot) ? "-1" : split.pop()!;
        const end = await parsePageNumber(endRaw, getCachedPageCount);
        if (start < end) {
          for (let i = start; i <= end; i++) {
            parsed.push(i);
          }
        } else {
          for (let i = start; i >= end; i--) {
            parsed.push(i);
          }
        }
      } else {
        const n = await parsePageNumber(seg, getCachedPageCount);
        parsed.push(n);
      }
    }
    return parsed;
  } catch (_) {
    throw "Invalid page-selection syntax.";
  }
}

async function parsePageNumber(
  s: string,
  getCachedPageCount: () => Promise<number>,
): Promise<number> {
  let n = parseInt(s);
  if (isNaN(n)) throw 1;
  if (n < 0) {
    const pageCount = await getCachedPageCount();
    n = pageCount + n + 1;
    if (n < 0) throw 2;
  }
  return n;
}

export async function getPageCount(pdf: File): Promise<number> {
  const pdfjs = await loadPdfjs();
  const buf = await pdf.arrayBuffer();
  const doc = await pdfjs.getDocument(buf).promise;
  return doc.numPages;
}

export function simplifyPageSelection(pages: number[]): string {
  const simplified = [];
  for (let i = 0; i < pages.length; i++) {
    const start = pages[i];
    let end = start;
    while (pages[i + 1] === end + 1) {
      end += 1;
      i += 1;
    }
    if (start === end) {
      while (pages[i + 1] === end - 1) {
        end -= 1;
        i += 1;
      }
    }
    if (start !== end) {
      simplified.push(`${start}..${end}`);
    } else {
      simplified.push(start);
    }
  }
  return simplified.join(",");
}

export function canvasToImage(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  name: string,
): Promise<File> {
  return new Promise((resolve) => {
    let ext = "png";
    let mimeType = "image/png";
    let quality = undefined;
    if (format.type === ImageFormatType.Jpeg) {
      ext = "jpg";
      mimeType = "image/jpeg";
      quality = (format.quality || 92) / 100;
    }
    name = replaceExt(name, ext);
    canvas.toBlob(
      (x) => resolve(new File([x!], name, { type: mimeType })),
      mimeType,
      quality,
    );
  });
}

export function findParentWithClass(
  el: HTMLElement,
  className: string,
): HTMLElement | undefined {
  return findParent(el, (x) => x.classList.contains(className));
}

export function findParent(
  el: HTMLElement,
  cond: (el: HTMLElement) => boolean,
): HTMLElement | undefined {
  if (cond(el)) return el;
  if (el.parentElement) return findParent(el.parentElement, cond);
}
