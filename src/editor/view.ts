import * as html from "html/editor/view.ts";
import * as crisp from "crisp-styles";
import { classNames } from "crisp-styles";
import { State, Tool } from "./state.ts";
import { FieldType } from "./field.ts";

export class View {
  public tp: html.View;
  public selTp: html.Selection;
  public toolbarBtns: HTMLElement[];

  constructor(public state: State) {
    this.tp = new html.View();
    this.selTp = new html.Selection();
    this.toolbarBtns = Array.from(this.tp.toolbar.children) as HTMLElement[];
  }

  public renderTool() {
    const { tool } = this.state;

    for (const el of this.toolbarBtns) {
      if (el.getAttribute("data-tool") === tool) {
        el.classList.add(classNames.bgSecondary, classNames.cBackground);
      } else {
        el.classList.remove(classNames.bgSecondary, classNames.cBackground);
      }
    }

    this.tp.viewer.style.cursor = tool === Tool.Move ? "" : "copy";
  }

  public renderSelection() {
    const { sel } = this.state;
    if (sel) {
      const { style } = sel.tp.base;
      const { style: selStyle } = this.selTp.base;
      selStyle.width = style.width;
      selStyle.height = style.height;
      selStyle.transform = style.transform;
    }
    crisp.show(this.selTp.base, !!sel);
    crisp.show(this.tp.toolbar, !sel);
    crisp.show(this.tp.selToolbar, !!sel);
    const showClearBtn = sel
      ? sel.def.type !== FieldType.Checkbox && !!sel.value
      : false;
    crisp.show(this.tp.clearToolbarBtn, showClearBtn);
    crisp.hide(this.tp.backdrop);
  }
}
