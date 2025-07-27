import * as html from "html/editor/signaturePad.ts";
import font from "./HomemadeApple-Regular.ttf";
import * as crisp from "crisp-styles";

let loadedFont = false;

type Point = {
  x: number;
  y: number;
};

export class SignaturePad {
  public tp: html.SignaturePad;
  private canvas: HTMLCanvasElement;
  private accPoints!: Point[];
  private paths!: Path2D[];
  private pathData!: string[];
  private bounds!: number[][];
  private drawnPointCount!: number;
  private ctxProps: {
    strokeStyle: string;
    lineWidth: number;
    lineJoin: string;
    lineCap: string;
  };
  private ctx?: CanvasRenderingContext2D;
  private baseRect?: DOMRect;
  private mouseDown?: boolean;
  private midPoint?: Point;
  private animationFrame?: number;
  private drawMode: boolean;

  constructor() {
    this.tp = new html.SignaturePad();
    this.canvas = this.tp.canvas;
    this.reset();
    this.ctxProps = {
      strokeStyle: "#000",
      lineWidth: 4,
      lineJoin: "round",
      lineCap: "round",
    };
    this.drawMode = true;

    this.tp.base.onmousedown = () => this.handleMouseDown();
    this.tp.base.ontouchstart = () => this.handleMouseDown();
    window.addEventListener("mousemove", (e) => this.handleMouseMove(e));
    window.addEventListener("mouseup", () => this.handleMouseUp());
    window.addEventListener("touchmove", (e) => this.handleMouseMove(e), {
      passive: false,
    });
    window.addEventListener("touchend", () => this.handleMouseUp());

    let width = window.innerWidth;
    window.addEventListener("resize", () => {
      if (window.innerWidth === width) return;
      width = window.innerWidth;
      this.reset();
      delete this.ctx;
    });

    if (!loadedFont) {
      loadedFont = true;
      const style = document.createElement("style");
      style.append(
        document.createTextNode(`
          @font-face {
            font-family: "HomemadeApple";
            src: url(${font}) format("truetype");
          }
      `),
      );
      document.head.append(style);
    }
  }

  public focus() {
    this.tp.input.focus();
  }

  public reset() {
    this.tp.input.value = "";
    this.accPoints = [];
    this.paths = [];
    this.pathData = [];
    this.bounds = [];
    this.drawnPointCount = 0;
    if (this.ctx) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  public setDrawMode(drawMode: boolean) {
    this.drawMode = drawMode;
    if (drawMode) {
      crisp.hide(this.tp.input);
    } else {
      this.reset();
      crisp.show(this.tp.input);
      this.tp.input.value = "";
      this.tp.input.select();
    }
  }

  public value(): Promise<Blob> {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    if (this.drawMode) {
      Object.assign(ctx, this.ctxProps);
      const { lineWidth } = this.ctxProps;
      const boundPoints = this.bounds.reduce((acc: Point[], bounds) => {
        acc.push(
          { x: bounds[0] - lineWidth, y: bounds[1] - lineWidth },
          { x: bounds[2] + lineWidth, y: bounds[3] + lineWidth },
        );
        return acc;
      }, []);
      const bounds = calcBounds(boundPoints);
      const width = bounds[2] - bounds[0];
      const height = bounds[3] - bounds[1];
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(
        this.tp.canvas,
        bounds[0],
        bounds[1],
        width,
        height,
        0,
        0,
        width,
        height,
      );
    } else {
      const inputStyle = window.getComputedStyle(this.tp.input);

      const containerEl = document.createElement("div");
      const { style: containerStyle } = containerEl;
      containerStyle.padding = "30px";
      containerStyle.display = "inline-block";
      containerStyle.position = "absolute";
      containerStyle.top = "0";
      containerStyle.visibility = "hidden";
      const textEl = document.createElement("div");
      textEl.textContent = this.tp.input.value;
      const { style: textStyle } = textEl;
      textStyle.fontFamily = inputStyle.fontFamily;
      textStyle.fontSize = inputStyle.fontSize;
      textStyle.lineHeight = inputStyle.fontSize;
      containerEl.append(textEl);
      document.body.append(containerEl);
      const size = containerEl.getBoundingClientRect();
      const left = textEl.offsetLeft;
      containerEl.remove();

      canvas.width = size.width;
      canvas.height = size.height;
      ctx.font = `${inputStyle.fontSize} ${inputStyle.fontFamily}`;
      ctx.textBaseline = "middle";
      ctx.fillText(this.tp.input.value, left, size.height / 2 + 8);
    }
    return new Promise((resolve) => canvas.toBlob((x) => resolve(x!)));
  }

  private handleMouseDown() {
    this.mouseDown = true;
    if (!this.ctx) {
      Object.assign(this.canvas, {
        width: this.canvas.offsetWidth,
        height: this.canvas.offsetHeight,
      });
      this.ctx = this.canvas.getContext("2d")!;
      Object.assign(this.ctx, this.ctxProps);
      this.baseRect = this.tp.base.getBoundingClientRect();
    }
  }

  private handleMouseUp() {
    this.mouseDown = false;
    delete this.midPoint;
    this.drawnPointCount = 0;

    if (!this.accPoints.length) return;

    const points = simplifyPoints(this.accPoints, 2.1);
    const pathData = points2PathData(points);
    this.paths.push(new Path2D(pathData));
    this.pathData.push(pathData);
    this.bounds.push(calcBounds(points));

    this.ctx!.clearRect(0, 0, this.canvas.width, this.canvas.height);
    for (const path of this.paths) {
      this.ctx!.stroke(path);
    }

    this.accPoints.length = 0;
  }

  private handleMouseMove(e: any) {
    if (!this.baseRect) return;

    if (this.mouseDown) {
      e.preventDefault(); // handle touch devices
      e = e.touches ? e.touches[0] : e;

      this.accPoints.push({
        x: e.clientX - this.baseRect!.left,
        y: e.clientY - this.baseRect!.top,
      });
      this.requestRender();
    }
  }

  private requestRender() {
    cancelAnimationFrame(this.animationFrame!);
    this.animationFrame = requestAnimationFrame(() => {
      this.render();
    });
  }

  private render() {
    const { accPoints, drawnPointCount } = this;
    const ctx = this.ctx!;

    const pointCount =
      accPoints.length - (accPoints.length % 2) - drawnPointCount;
    for (let i = 0; i < pointCount; i += 2) {
      const p1 = accPoints[drawnPointCount + i];
      const p2 = accPoints[drawnPointCount + i + 1];

      if (this.midPoint) {
        ctx.beginPath();
        ctx.moveTo(this.midPoint.x, this.midPoint.y);
      } else {
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
      }

      this.midPoint = calcMidPoint(p1, p2);
      ctx.quadraticCurveTo(p1.x, p1.y, this.midPoint.x, this.midPoint.y);

      ctx.stroke();
    }
    this.drawnPointCount += pointCount;
  }
}

function calcMidPoint(a: Point, b: Point): Point {
  const t = 0.5;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function calcBounds(points: Point[]): number[] {
  const bounds = [1e6, 1e6, -1e6, -1e6];

  for (const { x, y } of points) {
    bounds[0] = Math.min(bounds[0], x);
    bounds[1] = Math.min(bounds[1], y);
    bounds[2] = Math.max(bounds[2], x);
    bounds[3] = Math.max(bounds[3], y);
  }

  return bounds;
}

// simplification using Ramer-Douglas-Peucker algorithm
function simplifyPoints(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  const sqTolerance = tolerance * tolerance;
  const last = points.length - 1;

  const simplified = [points[0]];
  simplifyDPStep(points, 0, last, sqTolerance, simplified);
  simplified.push(points[last]);

  return simplified;
}

function simplifyDPStep(
  points: Point[],
  first: number,
  last: number,
  sqTolerance: number,
  simplified: Point[],
) {
  let maxSqDist = sqTolerance;
  let index!: number;

  for (let i = first + 1; i < last; i++) {
    const sqDist = calcSqSegDist(points[i], points[first], points[last]);

    if (sqDist > maxSqDist) {
      index = i;
      maxSqDist = sqDist;
    }
  }

  if (maxSqDist > sqTolerance) {
    if (index - first > 1) {
      simplifyDPStep(points, first, index, sqTolerance, simplified);
    }

    simplified.push(points[index]);

    if (last - index > 1) {
      simplifyDPStep(points, index, last, sqTolerance, simplified);
    }
  }
}

// square distance from a point to a segment
function calcSqSegDist(p: Point, p1: Point, p2: Point): number {
  var x = p1.x;
  let y = p1.y;
  let dx = p2.x - x;
  let dy = p2.y - y;

  if (dx !== 0 || dy !== 0) {
    const t = ((p.x - x) * dx + (p.y - y) * dy) / (dx * dx + dy * dy);

    if (t > 1) {
      x = p2.x;
      y = p2.y;
    } else if (t > 0) {
      x += dx * t;
      y += dy * t;
    }
  }

  dx = p.x - x;
  dy = p.y - y;

  return dx * dx + dy * dy;
}

function points2PathData(points: Point[]): string {
  const data = [];
  let p1 = points[0];
  let p2 = points[1];
  let i = 1;

  data.push("M" + p1.x + " " + p1.y);

  while (i < points.length) {
    if (!equalPoints(p1, p2)) {
      const midPoint = calcMidPoint(p1, p2); // p1 is our bezier control point
      // midpoint is our endpoint
      // start point is p(i-1) value.
      data.push("Q" + p1.x + " " + p1.y + " " + midPoint.x + " " + midPoint.y);
    }

    p1 = points[i];

    if (i + 1 < points.length) {
      p2 = points[i + 1];
    }

    i++;
  }

  data.push("L" + p1.x + " " + p1.y);

  return data.join("");
}

function equalPoints(a: Point, b: Point): boolean {
  const tol = 3 / window.devicePixelRatio;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return dx * dx + dy * dy < tol * tol;
}
