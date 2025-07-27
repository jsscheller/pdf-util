import { View } from "./view.ts";
import { State, Tool } from "./state.ts";
import { Viewer } from "./viewer.ts";
import * as crisp from "crisp-styles";
import * as html from "html/editor/view.ts";
import * as fieldHtml from "html/editor/field.ts";
import {
  FieldHandle,
  FieldDef,
  FieldType,
  FieldValueEditor,
  getDefaultLabel,
  renderField,
  updateField,
  serializeValue,
} from "./field.ts";
import css from "out/editor/index.css";
import { Annotation } from "../sign.ts";
import * as util from "../util.ts";

let sheet: CSSStyleSheet | undefined;

/** @link pickers.js */
export class Editor extends HTMLElement {
  public pdf!: Blob;
  private state: State;
  private view: View;
  private viewer: Viewer;
  private fieldEditor: FieldValueEditor;
  private init?: boolean;

  constructor() {
    super();

    this.attachShadow({ mode: "open" });
    const shadowRoot = this.shadowRoot!;

    if (!sheet) {
      sheet = new CSSStyleSheet();
      sheet.replaceSync(css);
    }
    shadowRoot.adoptedStyleSheets = [sheet!];

    this.state = new State();
    this.view = new View(this.state);
    shadowRoot.append(this.view.tp.base);
    this.viewer = new Viewer(
      this.view.tp.base,
      this.view.tp.zoomInBtn,
      this.view.tp.zoomOutBtn,
    );
    this.fieldEditor = new FieldValueEditor(this.viewer, this.state.fields);

    this.view.tp.viewer.append(this.viewer.tp.base);
    this.view.tp.base.append(this.fieldEditor.tp.base);

    this.fieldEditor.onChange = () => this.view.renderSelection();
    this.viewer.onResize = () => this.handleResize();
    for (const el of this.view.toolbarBtns) {
      el.onclick = (e) => this.handleToolBtnClick(e);
    }
    const { tp } = this.view;
    tp.viewer.onmousedown = (e) => this.handleViewerMouseDown(e);
    tp.closeToolbarBtn.onclick = () => this.clearSelection();
    tp.editToolbarBtn.onclick = () => this.fieldEditor.edit(this.state.sel!);
    tp.clearToolbarBtn.onclick = () => this.fieldEditor.clear(this.state.sel!);
    tp.removeToolbarBtn.onclick = () => this.handleRemoveToolbarBtnClick();
    window.addEventListener("mousemove", (e) => this.handleWindowMouseMove(e));
    window.addEventListener("mouseup", () => this.handleWindowMouseUp());
  }

  public getAnnotations(): Promise<Annotation[]> {
    return this.viewer.getAnnotations(this.state.fields);
  }

  public async connectedCallback() {
    if (this.init) return;
    this.init = true;

    this.viewer.tp.base.style.paddingTop = crisp.px(
      this.view.tp.toolbar.offsetHeight + 30,
    );
    this.setTool(this.state.tool);

    await this.viewer.init(this.pdf);
  }

  private setTool(tool: Tool) {
    this.state.tool = tool;
    this.view.renderTool();
  }

  private select(field: FieldHandle) {
    this.state.sel = field;
    this.view.renderSelection();

    const page = this.viewer.getPage(field.def.page);
    page.tp.content.append(this.view.selTp.base);
  }

  private clearSelection() {
    delete this.state.sel;
    this.view.renderSelection();
  }

  private renderField(def: FieldDef): fieldHtml.Field {
    const page = this.viewer.getPage(def.page);
    return renderField(def, page.scale);
  }

  private updateField(field: FieldHandle, tp: fieldHtml.Field) {
    const page = this.viewer.getPage(field.def.page);
    updateField(field.def, tp, page.scale);
    this.fieldEditor.updateField(field);
  }

  private async handleToolBtnClick(e: Event) {
    const target = e.target! as HTMLElement;
    const tool = target.getAttribute("data-tool")!;
    if (!tool) return;
    if (tool === "done") {
      for (const field of this.state.fields) {
        if (field.value) {
          field.def.value = await serializeValue(field);
        }
      }
      const defs = JSON.stringify(
        this.state.fields.map((x) => x.def),
        null,
        2,
      );
      const fields = new File([defs], "fields.json");
      const e = new CustomEvent("submit", {
        detail: fields,
        bubbles: true,
        composed: true,
      });
      this.shadowRoot!.dispatchEvent(e);
    } else {
      this.setTool(tool as Tool);
    }
  }

  private handleViewerMouseDown(e: MouseEvent) {
    const { state } = this;
    const target = e.target! as HTMLElement;
    const pt: [number, number] = [e.clientX, e.clientY];

    const corner = target.classList.contains(html.selectionCorner);
    const sideX = target.classList.contains(html.selectionSideX) || corner;
    const sideY = target.classList.contains(html.selectionSideY) || corner;
    if (sideX || sideY || target.classList.contains(html.selection)) {
      state.transform = {
        origin: pt,
        def: Object.assign({}, state.sel!.def),
        sideX,
        left: target.offsetLeft === 0,
        sideY,
        top: target.offsetTop === 0,
      };
      return;
    }

    const fieldEl = util.findParentWithClass(target, fieldHtml.field);
    if (fieldEl) {
      const field = state.fields.find((x) => x.tp.base === fieldEl)!;
      this.select(field);
      return;
    }

    this.clearSelection();

    const page = this.viewer.pageForTarget(target);
    if (page && state.tool !== Tool.Move) {
      const ppt = this.viewer.projectMouseToPage(pt, page);
      const type = state.tool as any as FieldType;
      const def: FieldDef = {
        type,
        page: page.pageNum,
        scale: page.scale,
        x: ppt[0],
        y: ppt[1],
        width: type === FieldType.Checkbox ? 60 : 200,
        height: 60,
        color: "#f9e39d",
        label: getDefaultLabel(type),
        signee: "",
      };
      const tp = this.renderField(def);
      page.tp.content.append(tp.base);
      const field = { def, tp };
      state.fields.push(field);
      this.setTool(Tool.Move);
      this.select(field);
      this.fieldEditor.edit(this.state.sel!);
    }
  }

  private handleWindowMouseMove(e: MouseEvent) {
    const { transform } = this.state;
    if (!transform) return;

    const { clientX, clientY } = e;
    let dx = 0;
    let dw = 0;
    let dy = 0;
    let dh = 0;
    if (transform.sideX) {
      if (transform.left) {
        dx = clientX - transform.origin[0];
        dw = -dx;
      } else {
        dw = clientX - transform.origin[0];
      }
    }
    if (transform.sideY) {
      if (transform.top) {
        dy = clientY - transform.origin[1];
        dh = -dy;
      } else {
        dh = clientY - transform.origin[1];
      }
    }
    if (!transform.sideX && !transform.sideY) {
      dx = clientX - transform.origin[0];
      dy = clientY - transform.origin[1];
    }

    const { def: init } = transform;
    const { def } = this.state.sel!;
    const page = this.viewer.getPage(def.page);
    const scale = def.scale / page.scale;
    def.x = init.x + dx * scale;
    def.y = init.y + dy * scale;
    def.width = init.width + dw * scale;
    def.height = init.height + dh * scale;
    this.updateField(this.state.sel!, this.state.sel!.tp);
    this.view.renderSelection();
  }

  private handleWindowMouseUp() {
    delete this.state.transform;
  }

  private handleRemoveToolbarBtnClick() {
    const sel = this.state.sel!;
    this.clearSelection();
    const index = this.state.fields.indexOf(sel);
    this.state.fields.splice(index, 1);
    sel.tp.base.remove();
  }

  private handleResize() {
    for (const field of this.state.fields) {
      this.updateField(field, field.tp);
    }
    if (this.state.sel) this.view.renderSelection();
  }
}
