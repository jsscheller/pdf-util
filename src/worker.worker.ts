import * as comlink from "comlink";
import gsJsUrl from "out/gs.wasm.js";
import gsWasmUrl from "@jspawn/ghostscript-wasm/gs.wasm";
import qpdfJsUrl from "out/qpdf.wasm.js";
import qpdfWasmUrl from "qpdf-wasm/qpdf.wasm";
import pdfcpuJsUrl from "out/pdfcpu.wasm.js";
import pdfcpuWasmUrl from "pdfcpu-wasm/pdfcpu.wasm";
import { Pdf2Docx } from "pdf2docx-wasm";
import mutoolJsUrl from "out/mutool.wasm.js";
import mutoolWasmUrl from "mutool-wasm/mutool.wasm";

let initGsModule: any;
let initMutoolModule: any;
let initQpdfModule: any;
let pdfcpu: any;
let pdf2Docx: Pdf2Docx;

export type StdoutConfig = {
  stderr?: (buf: string) => void;
  stdout?: (buf: string) => void;
};

export class WorkerThread {
  public async callGs(
    input: File | File[] | { name: string; data: Blob }[],
    args: string[],
    outputPath: string,
    mimeType: string = "application/pdf",
  ): Promise<File> {
    const gs = await initGs(input);
    gs.callMain(args);
    return readFile(gs, outputPath, mimeType);
  }

  public async callMutool(
    input: File | File[] | { name: string; data: Blob }[],
    args: string[],
    outputPath: string | string[],
    mimeType: string = "application/pdf",
  ): Promise<File | File[]> {
    const mutool = await initMutool(input);
    mutool.callMain(args);
    if (Array.isArray(outputPath)) {
      const outputFiles = [];
      for (const path of outputPath) {
        outputFiles.push(await readFile(mutool, path, mimeType));
      }
      return outputFiles;
    } else {
      return readFile(mutool, outputPath, mimeType);
    }
  }

  public async callQpdf(
    input: File | File[] | { name: string; data: Blob }[],
    args: string[],
    outputPath: string,
    mimeType: string = "application/pdf",
  ): Promise<File> {
    let stderr = "";
    const stdoutConfig = {
      stderr: (x: string) => (stderr += x),
    };
    const qpdf = await initQpdf(input, stdoutConfig);
    qpdf.callMain(args);
    if (stderr.includes("invalid password")) {
      throw "This PDF is password-protected - the correct password is required.";
    }
    return readFile(qpdf, outputPath, mimeType);
  }

  public async callQpdfStdout(
    input: File | File[] | { name: string; data: Blob }[],
    args: string[],
  ): Promise<{ stderr: string; stdout: string }> {
    let stderr = "";
    let stdout = "";
    const stdoutConfig = {
      stderr: (x: string) => (stderr += x),
      stdout: (x: string) => (stdout += x),
    };
    const qpdf = await initQpdf(input, stdoutConfig);
    qpdf.callMain(args);
    return { stderr, stdout };
  }

  public async callPdfcpu(
    input: File | File[] | { name: string; data: Blob }[],
    args: string[],
    outputPath: string,
    mimeType: string = "application/pdf",
  ): Promise<File> {
    if (!Array.isArray(input)) {
      input = [input];
    }
    const blobs = input as { name: string; data: Blob }[];
    if (blobs[0]?.data) {
      input = blobs.map(
        (x) => new File([x.data], x.name, { type: x.data.type }),
      );
    }

    if (!pdfcpu) {
      const { Pdfcpu } = await import(
        new URL(pdfcpuJsUrl, import.meta.url).href
      );
      pdfcpu = new Pdfcpu(pdfcpuWasmUrl);
    }

    const outputDir = await pdfcpu.run(args, input);
    const relOutputPath = outputPath.replace(/^\/output\//, () => "");
    return outputDir.readFile(relOutputPath, mimeType);
  }

  public async callPdf2Docx(
    input: File,
    outputName: string,
    sel?: number[],
  ): Promise<File> {
    if (!pdf2Docx) {
      const assetPath =
        import.meta.url.split("/").slice(0, -1).join("/") + "/" + "pdf2docx/";
      pdf2Docx = new Pdf2Docx(assetPath);
    }
    const docx = await pdf2Docx.convert(input, sel);
    return new File([docx], outputName, { type: docx.type });
  }
}

async function initGs(
  input: File | File[] | { name: string; data: Blob }[],
): Promise<any> {
  if (!initGsModule) {
    const global = globalThis as any;
    global.exports = {};
    await import(new URL(gsJsUrl, import.meta.url).href);
    initGsModule = global.exports.Module;
  }
  const gs = await initGsModule({
    locateFile: () => {
      return new URL(gsWasmUrl, import.meta.url).href;
    },
  });
  initModule(gs, input);
  return gs;
}

async function initMutool(
  input: File | File[] | { name: string; data: Blob }[],
): Promise<any> {
  if (!initMutoolModule) {
    const imports = await import(mutoolJsUrl);
    initMutoolModule = imports.default;
  }
  const mutool = await initMutoolModule({
    locateFile: () => {
      return new URL(mutoolWasmUrl, import.meta.url).href;
    },
  });
  initModule(mutool, input);
  return mutool;
}

async function initQpdf(
  input: File | File[] | { name: string; data: Blob }[],
  stdoutConfig?: StdoutConfig,
): Promise<any> {
  const jsUrl = new URL(qpdfJsUrl, import.meta.url).href;
  if (!initQpdfModule) {
    const imports = await import(jsUrl);
    initQpdfModule = imports.default;
  }
  const qpdf = await initQpdfModule({
    noFSInit: !!stdoutConfig,
    locateFile: (url: string) => {
      return url.endsWith(".wasm")
        ? new URL(qpdfWasmUrl, import.meta.url).href
        : jsUrl;
    },
  });
  initModule(qpdf, input, stdoutConfig);
  return qpdf;
}

function initModule(
  mod: any,
  input: File | File[] | { name: string; data: Blob }[],
  stdoutConfig?: StdoutConfig,
) {
  if (stdoutConfig) {
    const stderr = stdoutConfig.stderr
      ? new LineOut(stdoutConfig.stderr)
      : undefined;
    const stdout = stdoutConfig.stdout
      ? new LineOut(stdoutConfig.stdout)
      : undefined;
    mod.FS.init(
      undefined,
      stdout ? (x: number) => stdout.push(x) : undefined,
      stderr ? (x: number) => stderr.push(x) : undefined,
    );
  }
  mod.FS.mkdir("/input");
  if (!Array.isArray(input)) input = [input];
  const mount = (input[0] as any)?.data ? { blobs: input } : { files: input };
  mod.FS.mount(mod.WORKERFS, mount, "/input");
  mod.FS.mkdir("/output");
}

class LineOut {
  len: number;
  buf: Uint8Array;
  textDec?: TextDecoder;

  constructor(public callback: (buf: string) => void) {
    this.len = 0;
    this.buf = new Uint8Array(256);
  }

  push(charCode: number) {
    if (this.buf.length === this.len) {
      this.buf = resizeBuffer(this.buf, this.len * 2);
    }
    this.buf[this.len] = charCode;

    if (charCode === 10) {
      if (!this.textDec) this.textDec = new TextDecoder();
      const s = this.textDec.decode(this.buf.subarray(0, this.len));
      this.callback(s);
      this.len = 0;
    } else {
      this.len += 1;
    }
  }
}

// Allocates a new backing store for the given node so that it can fit at least newSize amount of bytes.
// May allocate more, to provide automatic geometric increase and amortized linear performance appending writes.
// Never shrinks the storage.
function resizeBuffer(
  buf: Uint8Array,
  newCapacity: number,
  prevLen: number = buf.length,
): Uint8Array {
  const prevCapacity = buf ? buf.length : 0;
  if (prevCapacity >= newCapacity) {
    // No need to expand, the storage was already large enough.
    return buf;
  }
  // Don't expand strictly to the given requested limit if it's only a very small increase, but instead geometrically grow capacity.
  // For small filesizes (<1MB), perform size*2 geometric increase, but for large sizes, do a much more conservative size*1.125 increase to
  // avoid overshooting the allocation cap by a very large margin.
  const CAPACITY_DOUBLING_MAX = 1024 * 1024;
  newCapacity = Math.max(
    newCapacity,
    (prevCapacity * (prevCapacity < CAPACITY_DOUBLING_MAX ? 2.0 : 1.125)) >>> 0,
  );
  if (prevCapacity !== 0) {
    // At minimum allocate 256b for each file when expanding.
    newCapacity = Math.max(newCapacity, 256);
  }
  const prevBuf = buf;
  buf = new Uint8Array(newCapacity);
  if (prevLen > 0) {
    // Copy old data over to the new storage.
    buf!.set(prevBuf!.subarray(0, prevLen));
  }
  return buf;
}

function readFile(mod: any, path: string, mimeType?: string): File {
  const buf = mod.FS.readFile(path);
  const name = path.split("/").at(-1)!;
  return new File([buf], name, { type: mimeType || "" });
}

comlink.expose(WorkerThread);
