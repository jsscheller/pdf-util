import * as util from "./util.ts";

export type Annotation = ImageAnnotation | TextAnnotation;
export enum AnnotationType {
  Image = "image",
  Text = "text",
}

export type ImageAnnotation = {
  type: AnnotationType.Image;
  page: number;
  rect: Rect;
  file: File;
};

export type TextAnnotation = {
  type: AnnotationType.Text;
  page: number;
  rect: Rect;
  value: string;
};

export type Rect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Add a signature to a PDF.
 *
 * # Examples
 *
 * ```handle
 * pdf-util/sign(
 *     pdf = @file("sample-rental-agreement.pdf"),
 *     annotations = [
 *         /Image(file = @file("signature.png"), page = 3, rect = Rect(118, 261, 136, 56)),
 *     ]
 * )
 * ```
 */
export async function sign(
  pdf: File,
  /** @picker pdf-util/AnnotationPicker {"pdf": super.pdf} */
  annotations: Annotation[],
): Promise<File> {
  const buf = await pdf.arrayBuffer();
  const pdfjsMod = await util.loadPdfjs();
  const doc = await pdfjsMod.getDocument(buf).promise;

  let imIndex = 1;
  let annotIndex = 0;
  for (const annot of annotations) {
    const rect = [
      annot.rect.left,
      annot.rect.top,
      annot.rect.left + annot.rect.width,
      annot.rect.top + annot.rect.height,
    ];
    let pdfjsAnnot;
    switch (annot.type) {
      case AnnotationType.Image: {
        const url = URL.createObjectURL(annot.file);
        const canvas = await renderImageContain(
          url,
          annot.rect.width,
          annot.rect.height,
        );
        URL.revokeObjectURL(url);
        const bitmap = await createImageBitmap(canvas);
        pdfjsAnnot = {
          annotationType: 13, // Stamp
          rect,
          rotation: 0,
          bitmap,
          bitmapId: `im${imIndex++}`,
          pageIndex: annot.page - 1,
        };
        break;
      }
      case AnnotationType.Text: {
        pdfjsAnnot = {
          annotationType: 3, // FreeText
          rect,
          rotation: 0,
          fontSize: 12,
          color: [0, 0, 0],
          value: annot.value,
          pageIndex: annot.page - 1,
        };
      }
    }
    doc.annotationStorage.setValue(
      `pdfjs_internal_editor_${annotIndex++}`,
      pdfjsAnnot,
    );
  }

  const annotBuf = await doc.saveDocument();
  const annotPdf = new File([annotBuf], pdf.name, {
    type: "application/pdf",
  });

  const worker = await util.getWorker();
  const outputPath = util.outputPath(pdf.name, { suffix: "-signed" });
  return worker.callQpdf(
    [annotPdf],
    [util.inputPath(annotPdf.name), "--flatten-annotations=all", outputPath],
    outputPath,
  );
}

function renderImageContain(
  url: string,
  width: number,
  height: number,
): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const cx = canvas.getContext("2d")!;

    const img = new Image();
    img.onload = () => {
      const imageRatio = img.width / img.height;
      const canvasRatio = width / height;

      let drawWidth, drawHeight, x, y;

      // Determine dimensions to maintain aspect ratio while fitting within canvas
      if (imageRatio > canvasRatio) {
        // Image is wider than canvas (relative to height)
        drawWidth = width;
        drawHeight = width / imageRatio;
        x = 0;
        y = (height - drawHeight) / 2; // Center vertically
      } else {
        // Image is taller than canvas (relative to width)
        drawHeight = height;
        drawWidth = height * imageRatio;
        x = (width - drawWidth) / 2; // Center horizontally
        y = 0;
      }

      cx.drawImage(img, x, y, drawWidth, drawHeight);
      resolve(canvas);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
}
