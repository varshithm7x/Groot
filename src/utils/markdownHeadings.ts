export interface MarkdownHeading {
  level: number;
  text: string;
  line: number;
}

export function extractMarkdownHeadings(content: string): MarkdownHeading[] {
  const lines = content.split(/\r?\n/);
  const headings: MarkdownHeading[] = [];
  let fence: { marker: string; length: number } | null = null;
  const frontmatterEnd = lines[0]?.trim() === "---"
    ? lines.findIndex((line, index) => index > 0 && /^(---|\.\.\.)$/.test(line.trim()))
    : -1;
  const cleanText = (value: string) => value.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`\[\]]/g, "").trim();

  for (let index = frontmatterEnd >= 0 ? frontmatterEnd + 1 : 0; index < lines.length; index++) {
    const line = lines[index];
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = { marker, length: fenceMatch[1].length };
      else if (fence.marker === marker && fenceMatch[1].length >= fence.length && line.slice(fenceMatch[0].length).trim() === "") fence = null;
      continue;
    }
    if (fence) continue;

    const atx = line.match(/^ {0,3}(#{1,6})(?:[ \t]+|$)(.*)$/);
    if (atx) {
      const text = cleanText(atx[2].replace(/[ \t]+#+[ \t]*$/, ""));
      if (text) headings.push({ level: atx[1].length, text, line: index + 1 });
      continue;
    }

    const underline = lines[index + 1]?.match(/^ {0,3}(=+|-+)[ \t]*$/);
    if (underline && line.trim()) {
      headings.push({ level: underline[1][0] === "=" ? 1 : 2, text: cleanText(line), line: index + 1 });
      index++;
    }
  }

  return headings;
}
