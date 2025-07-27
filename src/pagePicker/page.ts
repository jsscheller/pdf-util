import { PagePicker, PDF, Dimensions } from "./index.ts";
import * as crisp from "crisp-styles";
import { classNames } from "crisp-styles";
import * as html from "html/pagePicker/index.ts";

type Rect = {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
};

export class Page {
  public tp: html.Page;
  public initPageNum: number;
  public initRotate: number;
  public renderedPreview?: boolean;
  public selected?: boolean;

  constructor(
    private pagePicker: PagePicker,
    public id: number,
    public pdf: PDF,
    public pageNum: number,
    public rotate: number,
    private dims: Dimensions,
  ) {
    this.tp = new html.Page();
    this.initPageNum = pageNum;
    this.initRotate = rotate;

    this.tp.base.id = id.toString();
    this.tp.base.onclick = this.handleBaseClick;
    this.tp.checkbox.onclick = this.handleCheckboxClick;

    crisp.hide(this.tp.checkbox, !pagePicker.allowSelect);
    this.tp.base.classList.toggle(classNames.cMove, !!pagePicker.allowMove);
  }

  public render(preview?: string) {
    Object.assign(this.tp.base.style, {
      width: crisp.px(this.dims.pageWidth),
      height: crisp.px(this.dims.pageHeight),
    });
    this.tp.preview.style.backgroundImage = preview ? `url(${preview})` : "";
    this.renderedPreview = !!preview;
    this.renderPageNum();
    this.renderRotate();
  }

  private renderPageNum() {
    this.tp.pageNum.innerText = (this.pageNum + 1).toString();
  }

  private renderRotate() {
    const scale =
      this.rotate % 180 > 0 ? this.dims.pageWidth / this.dims.pageHeight : 1;
    this.tp.preview.style.transform = `rotate(${this.rotate}deg) scale(${scale})`;
  }

  public rect(): Rect {
    return pageRectForEl(this.tp.base, this.dims);
  }

  public updateRotate(counter: boolean) {
    const inc = counter ? -90 : 90;
    let rotate = this.rotate + inc;
    rotate = rotate % 360;
    if (rotate < 0) rotate += 360;
    this.rotate = rotate;
    this.renderRotate();
  }

  public updatePageNum(pageNum: number) {
    this.pageNum = pageNum;
    this.renderPageNum();
  }

  public remove() {
    this.tp.base.remove();
  }

  public select() {
    if (!this.pagePicker.allowSelect || this.pagePicker.cancelNextClick) return;
    this.selected = !this.selected;
    this.tp.checkbox.classList.toggle("checked", this.selected);
    this.tp.base.classList.toggle("selected", this.selected);
    this.pagePicker.didSelect();
  }

  private handleCheckboxClick = (e: Event) => {
    e.stopPropagation();
    this.select();
  };

  private handleBaseClick = () => {
    this.select();
  };
}

export function pageElForEvent(e: MouseEvent): HTMLElement | undefined {
  return pageElForTarget(e.target as Element);
}

export function pageElForTarget(el: Element): HTMLElement | undefined {
  if (el.classList.contains("page-checkbox")) {
    el = el.parentElement!;
  }
  return el.classList.contains("page") ? (el as HTMLElement) : undefined;
}

export function pageRectForEl(el: HTMLElement, dims: Dimensions): Rect {
  return {
    x1: el.offsetLeft,
    x2: el.offsetLeft + dims.pageWidth,
    y1: el.offsetTop,
    y2: el.offsetTop + dims.pageHeight,
  };
}
