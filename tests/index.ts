import { test } from "uvu";
import * as assert from "uvu/assert";
import * as pdfUtil from "../src/index.ts";

test("compress", async function () {
  const pdf = await download("baked-alaska.pdf");
  await pdfUtil.compress(pdf);
});

test("unlock", async function () {
  const pdf = await download("secret-ingredient.pdf");
  await pdfUtil.unlock(pdf, "hotdog");
});

test("unlock throws", async function () {
  let err: any;
  try {
    const pdf = await download("secret-ingredient.pdf");
    await pdfUtil.unlock(pdf);
  } catch (e) {
    err = e as any;
  }
  assert.ok(err!.includes("password is required"));
});

test("lock", async function () {
  const pdf = await download("baked-alaska.pdf");
  await pdfUtil.lock(pdf, pdfUtil.Encryption.Aes256, "hotdog");
});

test("extractImages", async function () {
  const pdf = await download("baked-alaska.pdf");
  const images = await pdfUtil.extractImages(pdf, {
    type: pdfUtil.ImageFormatType.Png,
  });
  assert.equal(images.length, 9);
});

test("imageToPdf", async function () {
  const banana = await download("banana.jpg");
  const hotdog = await download("hotdog.png");
  await pdfUtil.imageToPdf([banana, hotdog]);
});

test("merge", async function () {
  const pdf = await download("baked-alaska.pdf");
  await pdfUtil.merge([
    { pdf, pageSelection: "3" },
    { pdf, pageSelection: "2,1" },
  ]);
});

test("pdfToImage", async function () {
  const pdf = await download("baked-alaska.pdf");
  const images = await pdfUtil.pdfToImage(
    pdf,
    {
      type: pdfUtil.ImageFormatType.Jpeg,
      quality: 92,
    },
    "1..3",
    300,
  );
  assert.equal(images.length, 3);
});

test("repage", async function () {
  const pdf = await download("baked-alaska.pdf");
  await pdfUtil.repage(pdf, "3,1,2");
});

test("removeImages", async function () {
  const pdf = await download("baked-alaska.pdf");
  await pdfUtil.removeImages(pdf);
});

test("split", async function () {
  const pdf = await download("baked-alaska.pdf");
  const pdfs = await pdfUtil.split(pdf, {
    type: pdfUtil.ChunksType.Fixed,
    value: 2,
  });
  assert.equal(pdfs.length, 2);
});

test("sign", async function () {
  const pdf = await download("sample-rental-agreement.pdf");
  await pdfUtil.sign(pdf, [
    {
      type: pdfUtil.AnnotationType.Image,
      rect: {
        left: 118,
        top: 261,
        width: 136,
        height: 56,
      },
      page: 3,
      file: await download("signature.png"),
    },
    {
      type: pdfUtil.AnnotationType.Text,
      rect: {
        left: 161,
        top: 312,
        width: 31,
        height: 37,
      },
      page: 3,
      value: "30th",
    },
    {
      type: pdfUtil.AnnotationType.Text,
      rect: {
        left: 315,
        top: 314,
        width: 28,
        height: 37,
      },
      page: 3,
      value: "May",
    },
    {
      type: pdfUtil.AnnotationType.Text,
      rect: {
        left: 408,
        top: 309,
        width: 16,
        height: 37,
      },
      page: 3,
      value: "20",
    },
    {
      type: pdfUtil.AnnotationType.Text,
      rect: {
        left: 412,
        top: 253,
        width: 47,
        height: 37,
      },
      page: 3,
      value: "5/30/20",
    },
  ]);
});

test("pdfToWord", async function () {
  const pdf = await download("baked-alaska.pdf");
  await pdfUtil.pdfToWord(pdf);
});

test("extractText", async function () {
  const pdf = await download("baked-alaska.pdf");
  const text = await pdfUtil.extractText(pdf, "1");
  assert.equal(text.length, 1);
  assert.ok(text[0].length > 0);
});

test("watermark", async function () {
  const pdf = await download("baked-alaska.pdf");
  await pdfUtil.watermark(pdf, "DRAFT", 48, "Helvetica", "#000000", 0.5, "1,2");
});

test("rotate", async function () {
  const pdf = await download("baked-alaska.pdf");
  await pdfUtil.rotate(pdf, 90, true);
});

test("flatten", async function () {
  const pdf = await download("baked-alaska.pdf");
  await pdfUtil.flatten(pdf);
});

async function download(asset: string): Promise<File> {
  const blob = await fetch(`/assets/${asset}`).then((x) => x.blob());
  return new File([blob], asset, { type: blob.type });
}

// function debug(file: File) {
//   const url = URL.createObjectURL(file);
//   const el = document.createElement("a");
//   el.href = url;
//   el.download = file.name;
//   document.body.append(el);
//   el.click();
//   el.remove();
// }

test.run();
