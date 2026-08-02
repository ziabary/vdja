import type { IntfTextBlock } from "./interfaces";

export default function blocksToMarkdown(blocks: IntfTextBlock[]): string {
  let md = "";
  for (const b of blocks) {
    const t = b.text.trim();
    if (!t) continue;

    if (b.type === "title") md += `# ${t}\n\n`;
    else if (b.type === "bullet") md += `- ${t}\n`;
    else if (b.type === "heading") md += `_${t}_\n\n`;
    else if (b.isBold) md += `**${t}**\n\n`;
    else if (b.isItalic) md += `*${t}*\n\n`;
    else md += `${t}\n\n---\n\n`;
  }
  return md.trim();
}