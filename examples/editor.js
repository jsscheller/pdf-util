import { Editor } from "/src/pickers.js";

(async () => {
  customElements.define("pdf-util-editor", Editor);

  const editor = document.createElement("pdf-util-editor");
  editor.pdf = await fetch("/assets/sample-rental-agreement.pdf").then((x) =>
    x.blob(),
  );
  window.editor = editor;

  document.body.append(editor);
})();
