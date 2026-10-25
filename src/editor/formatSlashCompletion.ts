import type { CompletionSource } from "@codemirror/autocomplete";
import { syntaxTree } from "@codemirror/language";

/** Reuse the active editor's formatting dispatcher and its native insertion dialogs. */
export const formatSlashCompletion: CompletionSource = (context) => {
  const match = context.matchBefore(/^\s*\/[\w ]*$/);
  if (!match) return null;
  for (
    let node = syntaxTree(context.state).resolveInner(context.pos, -1);
    node;
    node = node.parent!
  ) {
    if (["FencedCode", "CodeBlock", "InlineCode"].includes(node.name))
      return null;
  }
  const from = match.from + match.text.indexOf("/");
  const query = match.text.slice(match.text.indexOf("/") + 1).toLowerCase();
  return {
    from,
    filter: false,
    options: [
      ["Heading 1", "heading-1"],
      ["Heading 2", "heading-2"],
      ["Heading 3", "heading-3"],
      ["Bullet list", "bullet-list"],
      ["Numbered list", "numbered-list"],
      ["Quote", "blockquote"],
      ["Table", "table"],
      ["Image", "image"],
      ["Code block", "code-block"],
    ]
      .filter(([label]) => label.toLowerCase().includes(query))
      .map(([label, command]) => ({
        label,
        section: "Insert",
        type: "text",
        apply: (view, _completion, _from, to) => {
          view.dispatch({
            changes: { from, to, insert: "" },
            selection: { anchor: from },
          });
          view.focus();
          document.dispatchEvent(
            new CustomEvent("editor:format", { detail: { command } }),
          );
        },
      })),
  };
};
