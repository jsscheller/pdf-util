import { Dimensions } from "./index.ts";
import * as crisp from "crisp-styles";
import * as html from "html/pagePicker/index.ts";

export class Split {
  public tp: html.Split;
  public active?: boolean;

  constructor(dims: Dimensions) {
    this.tp = new html.Split();

    Object.assign(this.tp.base.style, {
      marginLeft: crisp.px(dims.pageWidth),
      width: crisp.px(dims.gap),
      height: crisp.px(dims.pageHeight),
    });

    this.tp.base.onclick = this.handleBaseClick;
  }

  public remove() {
    this.tp.base.remove();
  }

  private handleBaseClick = () => {
    this.active = !this.active;
    this.tp.line.classList.toggle("active", this.active);
    this.tp.icon.classList.toggle("active", this.active);
  };
}
