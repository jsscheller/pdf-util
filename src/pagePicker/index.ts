import { Page, pageElForEvent, pageElForTarget } from "./page.ts";
import { PageToolbar } from "./pageToolbar.ts";
import { Move } from "./move.ts";
import { Split } from "./split.ts";
import * as html from "html/pagePicker/index.ts";
import * as crisp from "crisp-styles";
import { classNames } from "crisp-styles";
import css from "out/pagePicker/index.css";
import * as util from "../util.ts";
import { ImageFormatType } from "../imageFormat.ts";

let SHEET: CSSStyleSheet | undefined;

export type PageSelection = {
  pdf: File;
  pageNum: number;
  rotate?: number;
};

export type PDF = {
  file: File;
  name: string;
};

export type Dimensions = {
  pageWidth: number;
  pageHeight: number;
  gap: number;
};

export type Point = {
  x: number;
  y: number;
};

/** @link pickers.js */
export class PagePicker extends HTMLElement {
  public pdfs!: File[];
  public allowInsert?: boolean;
  public allowSelect?: boolean;
  public allowMove?: boolean;
  public allowRotate?: boolean;
  public allowRemove?: boolean;
  public allowSplit?: boolean;
  private dims: Dimensions;
  private newPdfs: File[];
  private loadedPdfs: PDF[];
  private pages: Page[];
  private splits: Split[];
  private animationFrame?: number;
  private toolbarAnimationFrame?: number;
  private rendering?: boolean;
  private toolbarPage?: number;
  private idInc: number;
  private pageToolbar!: PageToolbar;
  private move!: Move;
  private mouseDown?: Point;
  cancelNextClick?: boolean;
  private tp: html.PagePicker;
  private init?: boolean;

  constructor() {
    super();

    const pageWidth = 200;
    this.dims = {
      pageWidth,
      pageHeight: Math.round((pageWidth / 8.5) * 11),
      gap: this.allowSplit ? 42 : 16,
    };
    this.newPdfs = [];
    this.loadedPdfs = [];
    this.splits = [];
    this.pages = [];
    this.idInc = 0;
    this.tp = new html.PagePicker();

    this.tp.splitContainer.style.gap = `${this.dims.gap}px 0`;
    this.tp.pageContainer.style.gap = crisp.px(this.dims.gap);
    Object.assign(this.tp.insertDoc.style, {
      width: crisp.px(this.dims.pageWidth),
      height: crisp.px(this.dims.pageHeight),
    });

    this.attachShadow({ mode: "open" });
    this.shadowRoot!.append(this.tp.base);

    if (!SHEET) {
      SHEET = new CSSStyleSheet();
      SHEET.replaceSync(css);
    }
    this.shadowRoot!.adoptedStyleSheets = [SHEET!];
  }

  public async connectedCallback() {
    if (!this.init) {
      this.init = true;

      crisp.hide(this.tp.splitContainer, !this.allowSplit);
      crisp.hide(this.tp.insertDoc, !this.allowInsert);
      crisp.hide(this.tp.selectAll, !this.allowSelect);

      this.pageToolbar = new PageToolbar(this);
      this.move = new Move(this, this.pages, this.dims, this.shadowRoot!);

      this.tp.base.append(
        this.pageToolbar.tp.base,
        this.move.ghostEl,
        this.move.indicatorEl,
      );

      this.tp.base.onmousemove = this.handleMouseMove;
      this.tp.base.onmousedown = this.handleMouseDown;
      this.tp.base.onmouseup = this.handleMouseUp;
      this.tp.base.onscroll = this.requestRender;
      this.tp.insertDoc.onclick = this.handleInsertDocClick;
      this.tp.insertDocFileInput.onchange = this.handleDocFileInputChange;
      this.tp.selectAll.onclick = this.handleSelectAllClick;
    }
    this.newPdfs = this.pdfs.slice();
    this.requestRender();
  }

  public get value(): any {
    const value = [];
    let pageOffset = 0;
    while (pageOffset < this.pages.length) {
      const pageSels = [];
      while (pageOffset < this.pages.length) {
        const page = this.pages[pageOffset]!;
        const split = this.splits[pageOffset];
        pageOffset += 1;
        const pageSel: PageSelection = {
          pdf: page.pdf.file,
          pageNum: page.initPageNum + 1,
        };
        if (page.rotate !== page.initRotate) {
          pageSel.rotate = page.rotate;
        }
        if ((this.allowSelect && page.selected) || !this.allowSelect) {
          pageSels.push(pageSel);
        }
        if (split && split.active) {
          break;
        }
      }
      value.push(pageSels);
    }
    return value;
  }

  private requestRender() {
    cancelAnimationFrame(this.animationFrame!);
    this.animationFrame = requestAnimationFrame(async () => {
      if (this.rendering) {
        this.requestRender();
      } else {
        this.rendering = true;
        await this.render();
        this.rendering = false;
      }
    });
  }

  private async render() {
    if (this.newPdfs.length > 0) {
      await this.loadNewPDFs();
    }

    const pagesToRender = this.visiblePages()
      .filter((x) => !x.renderedPreview)
      .slice(0, 10);

    if (pagesToRender.length === 0) return;

    await this.renderPages(pagesToRender);

    this.requestRender();
  }

  private async loadNewPDFs() {
    for (const file of this.newPdfs.splice(0, this.newPdfs.length)) {
      const name = `pdf${this.loadedPdfs.length}.pdf`;
      const pdf = { file, name };
      this.loadedPdfs.push(pdf);

      const worker = await util.getWorker();
      const { stdout } = await worker.callQpdfStdout(file, [
        "--warning-exit-0",
        "--json",
        util.inputPath(file.name),
      ]);
      const json = JSON.parse(stdout);

      for (const [index, pageJson] of json.pages.entries()) {
        const obj = json.objects[`obj:${pageJson.object}`];
        const rotate = (obj && obj.value && obj.value["/Rotate"]) || 0;
        const page = new Page(
          this,
          this.idInc++,
          pdf,
          index,
          rotate,
          this.dims,
        );
        page.render();
        this.tp.pageContainer.insertBefore(page.tp.base, this.tp.insertDoc);
        this.pages.push(page);

        const split = new Split(this.dims);
        this.tp.splitContainer.append(split.tp.base);
        this.splits.push(split);
      }
    }
  }

  private visiblePages(): Page[] {
    const top = window.scrollY;
    const start = this.pages.findIndex((x) => x.rect().y2 > top)!;
    const bottom = top + window.innerHeight;
    const endPage = this.pages
      .slice(start)
      .reverse()
      .find((x) => x.rect().y1 < bottom)!;
    const end = start + this.pages.indexOf(endPage);
    return this.pages.slice(start, end + 1);
  }

  private async renderPages(pages: Page[]) {
    const grouped: Map<File, Page[]> = pages.reduce((acc, page: Page) => {
      const key = page.pdf.file;
      if (!acc.has(key)) acc.set(key, []);
      acc.get(key)!.push(page);
      return acc;
    }, new Map());

    const pdfjs = await util.loadPdfjs();
    const canvas = document.createElement("canvas");
    for (const [file, pages] of grouped.entries()) {
      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument(buf).promise;
      const renderWidth = Math.ceil(this.dims.pageWidth / 4) * 4;
      const blobs: Blob[] = [];
      for (const pageNum of pages.map((x) => x.pageNum + 1)) {
        const page = await doc.getPage(pageNum);
        const initViewport = page.getViewport({ scale: 1 });
        const scale = renderWidth / initViewport.width;
        const viewport = page.getViewport({ scale });

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const cx = canvas.getContext("2d")!;
        await page.render({ canvasContext: cx, viewport }).promise;
        blobs.push(
          await util.canvasToImage(
            canvas,
            { type: ImageFormatType.Jpeg, quality: 92 },
            "page",
          ),
        );
      }

      for (const [index, blob] of blobs.entries()) {
        const url = URL.createObjectURL(blob);
        pages[index]!.render(url);
      }
    }
  }

  private updateToolbar(e: MouseEvent) {
    const pageEl = pageElForEvent(e);
    const prevToolbarPage = this.toolbarPage;
    if (!this.move.active && pageEl) {
      this.toolbarPage = parseInt(pageEl.id);
    } else {
      delete this.toolbarPage;
    }
    if (prevToolbarPage !== this.toolbarPage) {
      this.requestToolbarRender();
    }
  }

  private requestToolbarRender() {
    cancelAnimationFrame(this.toolbarAnimationFrame!);
    this.toolbarAnimationFrame = requestAnimationFrame(async () => {
      this.renderToolbar();
    });
  }

  private renderToolbar() {
    if (this.toolbarPage != null) {
      const page = this.pages.find((x) => x.id === this.toolbarPage);
      if (!page) return;
      this.pageToolbar.show(page);
    } else {
      this.pageToolbar.hide();
    }
  }

  private updatePageNums() {
    for (const [index, page] of this.pages.entries()) {
      page.updatePageNum(index);
    }
  }

  private handleMouseDown = (e: MouseEvent) => {
    this.mouseDown = { x: e.x, y: e.y };
  };

  private handleMouseUp = () => {
    delete this.mouseDown;

    if (this.move.active) {
      this.move.end();
      this.cancelNextClick = true;
      setTimeout(() => {
        this.cancelNextClick = false;
      });
      this.tp.splitContainer.classList.remove(classNames.peNone);
    }
  };

  private handleMouseMove = (e: MouseEvent) => {
    this.updateToolbar(e);

    if (this.move.active) {
      this.move.update(e);
    } else if (this.toolbarPage != null && this.mouseDown) {
      if (
        Math.abs(e.x - this.mouseDown.x) > 5 ||
        Math.abs(e.y - this.mouseDown.y) > 5
      ) {
        const page = this.pages.find((x) => x.id === this.toolbarPage)!;
        this.move.start(page, e);
        this.tp.splitContainer.classList.add(classNames.peNone);
      }
    }
  };

  private handleDocFileInputChange = () => {
    for (const file of Array.from(this.tp.insertDocFileInput.files!)) {
      this.newPdfs.push(file);
    }
    this.requestRender();

    this.tp.insertDocFileInput.value = "";
  };

  private handleInsertDocClick = () => {
    this.tp.insertDocFileInput.click();
  };

  private handleSelectAllClick = () => {
    const all = this.pages.every((x) => x.selected);
    for (const page of this.pages) {
      if ((all && page.selected) || (!all && !page.selected)) {
        page.select();
      }
    }
    this.didSelect();
  };

  public didRemovePage(page: Page, e: MouseEvent) {
    page.remove();
    const index = this.pages.indexOf(page);
    this.pages.splice(index, 1);
    this.updatePageNums();

    const lastSplit = this.splits.pop()!;
    lastSplit.remove();

    delete this.toolbarPage;
    this.renderToolbar();

    const el = this.shadowRoot!.elementFromPoint(e.x, e.y);
    if (el) {
      const pageEl = pageElForTarget(el);
      if (pageEl) {
        this.toolbarPage = parseInt(pageEl.id);
        this.requestToolbarRender();
      }
    }
  }

  public didMovePage(from: number, to: number) {
    const page = this.pages[from];

    this.pages.splice(from, 1);
    this.pages.splice(to, 0, page);

    if (to === this.pages.length - 1) {
      this.tp.pageContainer.insertBefore(page.tp.base, this.tp.insertDoc);
    } else {
      const beforeEl = this.pages[to + 1].tp.base;
      this.tp.pageContainer.insertBefore(page.tp.base, beforeEl);
    }

    this.updatePageNums();
  }

  public didSelect() {
    const all = this.pages.every((x) => x.selected);
    this.tp.selectAllCheckbox.classList.toggle(html.checked, all);
  }
}
