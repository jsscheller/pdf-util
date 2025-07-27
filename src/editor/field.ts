import * as html from "html/editor/field.ts";
import * as crisp from "crisp-styles";
import { SignaturePad } from "./signaturePad.ts";
import { Viewer } from "./viewer.ts";

export type Doc = {
  pdf: Blob;
  fields: FieldDef[];
};

export type FieldDef = {
  type: FieldType;
  page: number;
  scale: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
  signee: string;
  optional?: boolean;
  value?: string;
};

export const enum FieldType {
  Signature = "signature",
  Initials = "initials",
  Date = "date",
  Text = "text",
  Checkbox = "checkbox",
}

export type FieldHandle = {
  def: FieldDef;
  tp: html.Field;
  value?: string;
};

export function getDefaultLabel(type: FieldType): string {
  switch (type) {
    case FieldType.Signature:
      return "Sign";
    case FieldType.Initials:
      return "Initial";
    case FieldType.Date:
      return "MM/DD/YYYY";
    default:
      return "";
  }
}

export function renderField(field: FieldDef, pageScale: number): html.Field {
  const tp = new html.Field();
  if (field.type === FieldType.Checkbox) {
    tp.base.classList.add("icon-checkbox-unchecked");
    crisp.hide(tp.icon);
  }
  updateField(field, tp, pageScale);
  return tp;
}

export function updateField(
  field: FieldDef,
  tp: html.Field,
  pageScale: number,
) {
  const scale = pageScale / field.scale;
  tp.color.style.backgroundColor = field.color;
  const { style } = tp.base;
  style.width = crisp.px(field.width * scale);
  style.height = crisp.px(field.height * scale);
  style.lineHeight = crisp.px(field.height * scale);
  style.transform = `translate(${field.x * scale}px, ${field.y * scale}px)`;

  if (field.type !== FieldType.Checkbox) {
    const icon = field.type;
    const old = Array.from(tp.icon.classList).find((x) =>
      x.startsWith("icon-"),
    )!;
    if (old) {
      tp.icon.classList.replace(old, `icon-${icon}`);
    } else {
      tp.icon.classList.add(`icon-${icon}`);
    }
  }

  tp.label.textContent = field.label;
  crisp.show(
    tp.label,
    field.label.length > 0 && field.type !== FieldType.Checkbox,
  );
}

export function formatDateField(field: FieldDef, value: string): string {
  const [y, m, d] = value.split("-");
  switch (field.label) {
    case "DD/MM/YYYY":
      return `${d}/${m}/${y}`;
    case "MM.DD.YYYY":
      return `${m}.${d}.${y}`;
    case "DD.MM.YYYY":
      return `${d}.${m}.${y}`;
    case "YYYY-MM-DD":
      return `${y}-${m}-${d}`;
    default:
      return `${m}/${d}/${y}`;
  }
}

export async function serializeValue(field: FieldHandle): Promise<string> {
  if (
    field.def.type === FieldType.Signature ||
    field.def.type === FieldType.Initials
  ) {
    const blob = await fetch(field.value!).then((x) => x.blob());
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        resolve(res.split(",").at(-1)!);
      };
      reader.readAsDataURL(blob);
    });
  } else {
    return field.value!;
  }
}

export async function deserializeValue(def: FieldDef): Promise<string> {
  if (def.type === FieldType.Signature || def.type === FieldType.Initials) {
    const dataUrl = "data:image/png;base64," + def.value!;
    const blob = await fetch(dataUrl).then((x) => x.blob());
    return URL.createObjectURL(blob);
  } else {
    return def.value!;
  }
}

export class FieldValueEditor {
  public tp: html.FieldValueEditor;
  private signaturePad: SignaturePad;
  private sel?: FieldHandle;
  public onChange?: (field: FieldHandle) => void;

  constructor(
    private viewer: Viewer,
    private handles: FieldHandle[],
  ) {
    this.tp = new html.FieldValueEditor();
    this.signaturePad = new SignaturePad();

    this.tp.sigPad.append(this.signaturePad.tp.base);

    this.tp.close.onclick = () => this.tp.base.close();
    this.tp.submit.onclick = () => this.handleSubmit();
    this.tp.clear.onclick = () => this.signaturePad.reset();
    this.tp.sigMethodSelect.onchange = () => this.handleSigMethodChange();
    this.tp.sigUploadInput.onchange = () => this.handleSigUploadChange();
  }

  public clear(field: FieldHandle) {
    delete field.value;
    this.updateField(field);
    if (this.onChange) this.onChange(field);
  }

  public edit(field: FieldHandle) {
    if (field.def.type === FieldType.Checkbox) {
      this.toggleCheckbox(field);
      this.updateField(field);
    } else {
      if (
        !field.value &&
        (field.def.type === FieldType.Signature ||
          field.def.type === FieldType.Initials)
      ) {
        const existing = this.handles.findLast(
          (x) => x.def.type === field.def.type && x.value,
        );
        if (existing) {
          field.value = existing.value;
          this.updateField(field);
          return;
        }
      }
      this.showModal(field);
      this.sel = field;
    }
  }

  private showModal(field: FieldHandle) {
    [this.tp.sig, this.tp.text, this.tp.date, this.tp.clear].forEach((x) =>
      crisp.hide(x),
    );

    switch (field.def.type) {
      case FieldType.Signature:
      case FieldType.Initials:
        crisp.show(this.tp.sig);
        crisp.show(this.tp.clear);
        this.signaturePad.reset();
        break;
      case FieldType.Text:
        crisp.show(this.tp.text);
        this.tp.textArea.value = field.value || "";
        this.tp.textArea.placeholder = field.def.label || "Start typing...";
        setTimeout(() => this.tp.textArea.select());
        break;
      case FieldType.Date:
        crisp.show(this.tp.date);
        this.tp.dateInput.value = new Date().toISOString().slice(0, 10);
        break;
    }

    this.tp.base.showModal();
  }

  public updateField(field: FieldHandle) {
    const { tp } = field;
    switch (field.def.type) {
      case FieldType.Signature:
      case FieldType.Initials:
        tp.base.style.backgroundImage = field.value
          ? `url(${field.value})`
          : "";
        tp.base.style.color = field.value ? "transparent" : "";
        break;
      case FieldType.Text:
      case FieldType.Date:
        crisp.show(tp.labelContainer, !field.value);
        crisp.show(tp.valueContainer, !!field.value);
        if (field.value) {
          tp.value.textContent = field.value;
          const page = this.viewer.getPage(field.def.page);
          tp.value.style.transform = `scale(${page.scale})`;
          tp.value.style.fontSize = "12px";
          const { width } = tp.value.getBoundingClientRect();
          if (width > tp.base.offsetWidth) {
            tp.value.style.transform += ` scale(${tp.base.offsetWidth / width})`;
          }
        } else {
          tp.label.textContent = field.def.label;
        }
        break;
      case FieldType.Checkbox: {
        const checked = field.value === "checked";
        tp.base.classList.toggle("icon-checkbox-checked", checked);
        tp.base.classList.toggle("icon-checkbox-unchecked", !checked);
        break;
      }
    }
    crisp.show(tp.color, !field.value);
  }

  private updateFieldWithImage(blob: Blob) {
    const url = URL.createObjectURL(blob);
    this.sel!.value = url;
    this.updateField(this.sel!);
  }

  private toggleCheckbox(field: FieldHandle) {
    const checked = !(field.value === "checked");
    if (checked) {
      field.value = "checked";
    } else {
      delete field.value;
    }
  }

  private async handleSubmit() {
    this.tp.base.close();

    const field = this.sel!;
    switch (field.def.type) {
      case FieldType.Signature:
      case FieldType.Initials:
        const blob = await this.signaturePad.value();
        this.updateFieldWithImage(blob);
        break;
      case FieldType.Text:
        field.value = this.tp.textArea.value;
        this.updateField(field);
        break;
      case FieldType.Date:
        field.value = formatDateField(field.def, this.tp.dateInput.value);
        this.updateField(field);
        break;
    }

    if (this.onChange) this.onChange(field);
  }

  private handleSigMethodChange() {
    crisp.hide(this.tp.sigPad);
    crisp.hide(this.tp.sigUploadInput);

    const value = this.tp.sigMethodSelect.value;
    if (value.startsWith("Draw")) {
      this.signaturePad.setDrawMode(true);
      crisp.show(this.tp.sigPad);
    } else if (value.startsWith("Type")) {
      this.signaturePad.setDrawMode(false);
      crisp.show(this.tp.sigPad);
      this.signaturePad.focus();
    } else {
      crisp.show(this.tp.sigUploadInput);
    }
  }

  private handleSigUploadChange() {
    const file = this.tp.sigUploadInput.files!.item(0);
    if (!file) return;
    this.tp.sigUploadInput.value = "";
    this.updateFieldWithImage(file);
    this.tp.base.close();
  }
}
