import { FieldHandle, FieldDef } from "./field.ts";

export const enum Tool {
  Move = "move",
  Signature = "signature",
  Initials = "initials",
  Date = "date",
  Text = "text",
  Checkbox = "checkbox",
}

export type Transform = {
  origin: [number, number];
  def: FieldDef;
  sideX?: boolean;
  left?: boolean;
  sideY?: boolean;
  top?: boolean;
};

export class State {
  public fields: FieldHandle[];
  public tool: Tool;
  public sel?: FieldHandle;
  public transform?: Transform;

  constructor() {
    this.fields = [];
    this.tool = Tool.Move;
  }
}
