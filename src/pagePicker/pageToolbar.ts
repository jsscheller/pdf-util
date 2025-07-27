import { PagePicker } from "./index.ts";
import { Page } from "./page.ts";
import * as html from "html/pagePicker/index.ts";
import * as crisp from "crisp-styles";

export class PageToolbar {
  public tp: html.PageToolbar;
  private page?: Page;
  private isEmpty: boolean;

  constructor(private pagePicker: PagePicker) {
    this.tp = new html.PageToolbar();

    this.tp.base.onmousemove = this.handleMouseMove;
    this.tp.base.onmousedown = this.handleMouseDown;
    this.tp.rotate.onclick = this.handleRotateClick;
    this.tp.rotateCounter.onclick = this.handleRotateCounterClick;
    this.tp.remove.onclick = this.handleRemoveClick;

    crisp.hide(this.tp.rotate, !pagePicker.allowRotate);
    crisp.hide(this.tp.rotateCounter, !pagePicker.allowRotate);
    crisp.hide(this.tp.remove, !pagePicker.allowRemove);

    this.isEmpty = !pagePicker.allowRotate && !pagePicker.allowRemove;
  }

  public show(page: Page) {
    this.page = page;
    if (this.isEmpty) return;

    const rect = page.rect();
    this.tp.base.style.transform = `translate(${rect.x1}px, ${rect.y2}px) translate(-8px, -35px)`;
    crisp.show(this.tp.base);
  }

  public hide() {
    crisp.hide(this.tp.base);
  }

  private handleMouseMove = (e: Event) => {
    e.stopPropagation();
  };

  private handleMouseDown = (e: Event) => {
    e.stopPropagation();
  };

  private handleRotateClick = (_: Event) => {
    this.page!.updateRotate(false);
  };

  private handleRotateCounterClick = (_: Event) => {
    this.page!.updateRotate(true);
  };

  private handleRemoveClick = (e: MouseEvent) => {
    this.pagePicker.didRemovePage(this.page!, e);
  };
}
