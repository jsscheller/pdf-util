import { PagePicker } from "/src/pickers.js";

(async () => {
  customElements.define("page-picker", PagePicker);

  const pagePicker = document.createElement("page-picker");
  Object.assign(pagePicker, {
    pdfs: [
      await fetch("/assets/baked-alaska.pdf")
        .then((x) => x.blob())
        .then((x) => new File([x], "baked-alaska.pdf")),
    ],
    allowInsert: false,
    allowSelect: false,
    allowMove: true,
    allowRotate: false,
    allowRemove: true,
    allowSplit: true,
  });

  document.body.append(pagePicker);
})();
