import { PagePicker, Point, Dimensions } from "./index.ts";
import {
  Page,
  pageElForTarget,
  pageElForEvent,
  pageRectForEl,
} from "./page.ts";
import { classNames } from "crisp-styles";
import * as crisp from "crisp-styles";

export class Move {
  public active?: Page;
  private startPoint?: Point;
  private animationFrame?: number;
  private target?: HTMLElement;
  private targetLeading?: boolean;
  public ghostEl: HTMLElement;
  public indicatorEl: HTMLElement;

  constructor(
    private pagePicker: PagePicker,
    private pages: Page[],
    private dims: Dimensions,
    private shadowRoot: ShadowRoot,
  ) {
    this.ghostEl = crisp.createElement("div", {
      className: ["move-ghost", classNames.dNone],
    });
    this.indicatorEl = crisp.createElement("div", {
      style: { width: crisp.px(dims.gap) },
      className: ["move-indicator", classNames.dNone],
      children: [crisp.createElement("div")],
    });
  }

  public start(page: Page, e: MouseEvent) {
    this.active = page;
    this.startPoint = { x: e.x, y: e.y };
    delete this.target;

    const ghostEl = page.tp.base.cloneNode(true) as HTMLElement;
    for (const el of Array.from(ghostEl.children)) {
      if (!el.classList.contains("page-preview")) {
        el.remove();
      }
    }
    const rect = page.rect();
    Object.assign(this.ghostEl.style, {
      left: `${rect.x1}px`,
      top: `${rect.y1}px`,
    });
    crisp.show(this.ghostEl);
    this.ghostEl.innerHTML = "";
    this.ghostEl.append(ghostEl);
  }

  public update(e: MouseEvent) {
    cancelAnimationFrame(this.animationFrame!);

    const pt = { x: e.x, y: e.y };
    let pageEl = pageElForEvent(e);
    this.animationFrame = requestAnimationFrame(() => {
      const dx = pt.x - this.startPoint!.x;
      const dy = pt.y - this.startPoint!.y;
      Object.assign(this.ghostEl.style, {
        transform: `translate(${dx}px, ${dy}px)`,
      });

      pageEl = pageEl || this.findPageEl(pt);
      if (pageEl) {
        const rect = pageRectForEl(pageEl, this.dims);
        const leading = pt.x - rect.x1 < this.dims.pageWidth / 2;
        const x = leading ? rect.x1 : rect.x2;
        const adjust = leading ? -100 : 0;
        Object.assign(this.indicatorEl.style, {
          transform: `translate(${x}px, ${rect.y1}px) translateX(${adjust}%)`,
          height: `${this.dims.pageHeight}px`,
        });
        crisp.show(this.indicatorEl);
        this.target = pageEl;
        this.targetLeading = leading;
      } else {
        crisp.hide(this.indicatorEl);
        delete this.target;
      }
    });
  }

  private findPageEl(pt: Point): HTMLElement | undefined {
    const x = pt.x;
    for (const dx of [-this.dims.gap, this.dims.gap]) {
      pt.x = x + dx;
      const el = this.shadowRoot.elementFromPoint(pt.x, pt.y);
      if (el) {
        const pageEl = pageElForTarget(el);
        if (pageEl) return pageEl;
      }
    }
    return undefined;
  }

  public end() {
    if (this.target) {
      const from = this.pages.indexOf(this.active!);
      let to = this.pages.findIndex((x) => x.tp.base === this.target)!;
      if (from < to && this.targetLeading) {
        to -= 1;
      } else if (from > to && !this.targetLeading) {
        to += 1;
      }
      if (from !== to) {
        this.pagePicker.didMovePage(from, to);
      }
    }
    delete this.active;
    crisp.hide(this.ghostEl);
    crisp.hide(this.indicatorEl);
  }
}
