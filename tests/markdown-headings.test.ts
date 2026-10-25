import { expect, it } from "vitest";
import { extractMarkdownHeadings } from "../src/utils/markdownHeadings";

it("maps visible headings to source lines without including frontmatter or fenced examples", () => {
  const headings = extractMarkdownHeadings([
    "---", "title: Hidden", "---",
    "# Document", "## [Core idea](note.md) ##",
    "```md", "### Example only", "```",
    "Worked example", "--------------",
    "~~~md", "# Also hidden", "~~~",
    "### Detail",
  ].join("\n"));

  expect(headings).toEqual([
    { level: 1, text: "Document", line: 4 },
    { level: 2, text: "Core idea", line: 5 },
    { level: 2, text: "Worked example", line: 9 },
    { level: 3, text: "Detail", line: 14 },
  ]);
});
