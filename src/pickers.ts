import { PagePicker, PageSelection } from "./pagePicker/index.ts";
import { Annotation } from "./sign.ts";
import { Editor } from "./editor/index.ts";
import * as util from "./util.ts";

export { PagePicker } from "./pagePicker/index.ts";
export { Editor } from "./editor/index.ts";

/** @link pickers.js */
export class PageSelectionPicker extends PagePicker {
  public pdf!: File;

  public async connectedCallback() {
    this.pdfs = [this.pdf];
    this.allowSelect = true;
    this.allowMove = true;
    super.connectedCallback();
  }

  public get value(): string {
    const value = super.value as PageSelection[][];
    const pages = value[0]!;
    return util.simplifyPageSelection(pages.map((x) => x.pageNum));
  }
}

/** @link pickers.js */
export class ChunksPicker extends PagePicker {
  public pdf!: File;

  public async connectedCallback() {
    this.pdfs = [this.pdf];
    this.allowMove = true;
    this.allowRemove = true;
    this.allowSplit = true;
    super.connectedCallback();
  }

  public get value(): string[] {
    const value = super.value as PageSelection[][];
    return value.map((x) =>
      util.simplifyPageSelection(x.map((y) => y.pageNum)),
    );
  }
}

/** @link pickers.js */
export class AnnotationPicker extends Editor {
  public get value(): Promise<Annotation[]> {
    return this.getAnnotations();
  }
}
