import * as pdfjs from "pdfjs-dist";
import * as html from "html/editor/viewer.ts";
import { FieldHandle, FieldType } from "./field.ts";
import * as crisp from "crisp-styles";
import * as util from "../util.ts";
import { Annotation, AnnotationType, Rect } from "../sign.ts";

const PAGE_ATTR = "data-page";

export type PageHandle = {
  proxy: pdfjs.PDFPageProxy;
  pageNum: number;
  scale: number;
  tp: html.Page;
};

type RenderedPage = {
  pageNum: number;
  top: number;
  bottom: number;
  el: HTMLElement;
  url?: string;
};

export class Viewer {
  public tp: html.Viewer;
  private canvasEl: HTMLCanvasElement;
  private pages: PageHandle[];
  private renderedPages: RenderedPage[];
  private doc!: pdfjs.PDFDocumentProxy;
  private overdraw!: number;
  private renderPagesFrame?: number;
  private renderPagesGuard?: boolean;
  private resizeFrame?: number;
  public onResize?: () => void;
  private zoom: number;
  private scale?: number;

  constructor(
    public parent: HTMLElement,
    public zoomInBtn?: HTMLElement,
    public zoomOutBtn?: HTMLElement,
  ) {
    this.tp = new html.Viewer();
    this.canvasEl = document.createElement("canvas");
    this.pages = [];
    this.renderedPages = [];
    this.zoom = 1;

    this.tp.base.addEventListener("scroll", () => this.requestRenderPages());
    window.addEventListener("resize", () => this.handleWindowResize());
    if (zoomInBtn) {
      zoomInBtn.addEventListener("click", () => this.updateZoom(false));
    }
    if (zoomOutBtn) {
      zoomOutBtn.addEventListener("click", () => this.updateZoom(true));
    }
  }

  public async init(pdf: Blob) {
    this.overdraw = this.getPageSize()[1] / 2;

    const buf = await pdf.arrayBuffer();
    const pdfjsMod = await util.loadPdfjs();
    this.doc = await pdfjsMod.getDocument(buf).promise;

    for (let i = 1; i <= this.doc.numPages; i++) {
      const proxy = await this.doc.getPage(i);
      const viewport = this.getScaledViewport(proxy);

      const tp = new html.Page();
      tp.base.setAttribute(PAGE_ATTR, i.toString());
      this.tp.inner.append(tp.base);

      this.pages.push({ proxy, pageNum: i, scale: viewport.scale, tp });
    }
    this.renderPageContainers();
    this.requestRenderPages();
  }

  private scrollTop(): number {
    return window.scrollY;
  }

  public getPage(pageNum: number): PageHandle {
    if (pageNum === -1) return this.pages.at(-1)!;
    return this.pages[pageNum - 1]!;
  }

  public pageForTarget(target: EventTarget): PageHandle | undefined {
    if (target instanceof HTMLElement) {
      const pageEl = this.findPageEl(target);
      if (pageEl) {
        const pageNum = parseInt(pageEl.getAttribute(PAGE_ATTR)!);
        return this.pages[pageNum - 1];
      }
    }
  }

  private findPageEl(el: HTMLElement): HTMLElement | undefined {
    return util.findParent(el, (x) =>
      x.hasAttribute(PAGE_ATTR),
    )! as HTMLElement;
  }

  public projectMouseToPage(
    pt: [number, number],
    page: PageHandle,
  ): [number, number] {
    const x = pt[0] - page.tp.content.offsetLeft;
    const y = pt[1] - (page.tp.content.offsetTop - this.scrollTop());
    return [x, y];
  }

  public async getAnnotations(fields: FieldHandle[]): Promise<Annotation[]> {
    const checkboxImage = new CheckboxImage();
    const annots: Annotation[] = [];
    for (const field of fields) {
      if (!field.value) continue;
      const { def } = field;
      const page = this.getPage(def.page);
      const viewport = page.proxy.getViewport({ scale: def.scale });
      const rect = [
        def.x,
        viewport.height - (def.y + def.height),
        def.x + def.width,
        viewport.height - def.y,
      ].map((x) => x / def.scale);
      switch (def.type) {
        case FieldType.Checkbox:
        case FieldType.Signature:
        case FieldType.Initials: {
          let file;
          if (def.type === FieldType.Checkbox) {
            const blob = await checkboxImage.toBlob(def.width, def.height);
            file = new File([blob], "checkbox.png", { type: "image/png" });
          } else {
            const blob = await fetch(field.value).then((x) => x.blob());
            file = new File([blob], "signature.png", { type: "image/png" });
          }
          annots.push({
            type: AnnotationType.Image,
            rect: arrayToRect(rect),
            page: def.page,
            file,
          });
          break;
        }
        default: {
          const range = document.createRange();
          const textNode = field.tp.value.childNodes[0]!;
          range.selectNodeContents(textNode);
          const textRect = range.getBoundingClientRect();
          const baseRect = field.tp.base.getBoundingClientRect();

          const dx = (textRect.x - baseRect.x) / def.scale;
          const dy = (textRect.y - baseRect.y) / def.scale;
          rect[0] += dx;
          rect[2] += dx;
          rect[1] -= dy;
          rect[3] -= dy;

          annots.push({
            type: AnnotationType.Text,
            rect: arrayToRect(rect),
            page: def.page,
            value: field.value,
          });
        }
      }
    }
    return annots;
  }

  private async requestRenderPages() {
    window.cancelAnimationFrame(this.renderPagesFrame!);
    this.renderPagesFrame = window.requestAnimationFrame(() => {
      if (this.renderPagesGuard) {
        this.requestRenderPages();
      } else {
        this.renderPagesGuard = true;
        this.renderPages().finally(() => (this.renderPagesGuard = false));
      }
    });
  }

  private async renderPageContainers() {
    for (const page of this.pages) {
      const viewport = this.getScaledViewport(page.proxy);
      const { style } = page.tp.content;
      style.width = crisp.px(viewport.width);
      style.height = crisp.px(viewport.height);
      page.scale = viewport.scale;
    }
  }

  private async renderPages() {
    const [_, height] = this.getPageSize();
    const top = this.scrollTop();
    const bottom = top + height;
    for (let i = this.renderedPages.length - 1; i >= 0; i--) {
      const rp = this.renderedPages[i];
      const d = Math.min(Math.abs(rp.top - top), Math.abs(rp.bottom - bottom));
      if (d > height * 5) this.removeRenderedPage(i);
    }

    const topPage = this.pages.find(
      (x) => x.tp.base.offsetTop + x.tp.base.offsetHeight > this.scrollTop(),
    );
    if (!topPage) return;
    let pageEl = topPage.tp.base;

    const range = new RangeInclusive(
      Math.min(top - this.overdraw, pageEl.offsetTop),
      Math.max(bottom + this.overdraw, pageEl.offsetTop + pageEl.offsetHeight),
    );
    const newPages: RenderedPage[] = [];
    while (
      range.contains(pageEl.offsetTop) ||
      range.contains(pageEl.offsetTop + pageEl.offsetHeight)
    ) {
      const pageNum = parseInt(pageEl.getAttribute(PAGE_ATTR)!);
      if (!this.renderedPages.some((x) => x.pageNum === pageNum)) {
        const page: RenderedPage = {
          pageNum,
          top: pageEl.offsetTop,
          bottom: pageEl.offsetTop + pageEl.offsetHeight,
          el: pageEl as HTMLElement,
        };
        newPages.push(page);
        this.renderedPages.push(page);
      }
      pageEl = pageEl.nextElementSibling! as HTMLElement;
      if (!pageEl) break;
    }

    const proxies = newPages.map((x) => this.getPage(x.pageNum).proxy);
    for (const [index, proxy] of proxies.entries()) {
      const url = await this.renderPage(proxy);
      const rp = newPages[index]!;
      if (!this.renderedPages.includes(rp)) continue;
      const firstChild = rp.el.firstElementChild! as HTMLElement;
      firstChild.style.backgroundImage = `url(${url})`;
      rp.url = url;
    }
  }

  private async renderPage(proxy: pdfjs.PDFPageProxy): Promise<string> {
    const viewport = this.getScaledViewport(proxy);

    const width = Math.floor(viewport.width);
    const height = Math.floor(viewport.height);
    this.canvasEl.width = width;
    this.canvasEl.height = height;
    const { style } = this.canvasEl;
    style.width = crisp.px(width);
    style.height = crisp.px(height);

    const cx = this.canvasEl.getContext("2d")!;
    await proxy.render({ canvasContext: cx, viewport }).promise;
    const blob = await new Promise((resolve) => {
      this.canvasEl.toBlob(resolve, "image/png");
    });
    return URL.createObjectURL(blob as Blob);
  }

  private removeRenderedPage(index: number) {
    const rp = this.renderedPages[index]!;
    const firstChild = rp.el.firstElementChild! as HTMLElement;
    firstChild.style.backgroundImage = "";
    if (rp.url) URL.revokeObjectURL(rp.url!);
    this.renderedPages.splice(index, 1);
  }

  private getPageSize(): [number, number] {
    return [
      Math.min(this.tp.base.offsetWidth - 40, 1000),
      this.tp.base.offsetHeight - 80,
    ];
  }

  private getScaledViewport(page: pdfjs.PDFPageProxy): pdfjs.PageViewport {
    if (!this.scale) {
      const viewport = page.getViewport({ scale: 1 });
      const size = this.getPageSize();
      this.scale = size[1] / viewport.height;
      const scaled = page.getViewport({ scale: this.scale });
      if (scaled.width > size[0] || size[1] < 800) {
        this.scale = size[0] / viewport.width;
      }
    }
    return page.getViewport({ scale: this.scale * this.zoom });
  }

  private updateZoom(out: boolean) {
    let zoom = this.zoom + (out ? -0.5 : 0.5);
    zoom = Math.max(Math.min(zoom, 3), 0.5);
    if (zoom === this.zoom) return;
    this.zoom = zoom;
    this.handleWindowResize();
  }

  private handleWindowResize() {
    delete this.scale;
    window.cancelAnimationFrame(this.resizeFrame!);
    this.resizeFrame = window.requestAnimationFrame(() => {
      for (let i = this.renderedPages.length - 1; i >= 0; i--) {
        this.removeRenderedPage(i);
      }
      this.renderPageContainers();
      this.requestRenderPages();
      if (this.onResize) this.onResize();
    });
  }
}

class RangeInclusive {
  constructor(
    public start: number,
    public end: number,
  ) {}

  contains(test: number): boolean {
    return test >= this.start && test <= this.end;
  }
}

class CheckboxImage {
  static PATH = [
    6.375, 8.61538, 3, 12.0769, 9.75, 19, 21, 7.46154, 17.625, 4, 9.75, 12.0769,
    6.375, 8.61538,
  ];
  canvas: HTMLCanvasElement;

  constructor() {
    this.canvas = document.createElement("canvas");
  }

  toBlob(width: number, height: number): Promise<Blob> {
    const min = Math.min(width, height);
    const scale = min / 24;
    this.canvas.width = width;
    this.canvas.height = height;
    const cx = this.canvas.getContext("2d")!;
    cx.translate(width / 2 - (24 * scale) / 2, height / 2 - (24 * scale) / 2);
    cx.scale(scale, scale);
    cx.beginPath();
    for (let i = 0; i < CheckboxImage.PATH.length; i += 2) {
      const x = CheckboxImage.PATH[i];
      const y = CheckboxImage.PATH[i + 1];
      if (i === 0) {
        cx.moveTo(x, y);
      } else {
        cx.lineTo(x, y);
      }
    }
    cx.fill();
    return new Promise((resolve) => this.canvas.toBlob((x) => resolve(x!)));
  }
}

function arrayToRect(array: number[]): Rect {
  return {
    left: Math.round(array[0]),
    top: Math.round(array[1]),
    width: Math.round(array[2] - array[0]),
    height: Math.round(array[3] - array[1]),
  };
}
