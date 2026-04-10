import type { IconGlyph, Project } from '@/types';
import { formatCodepoint } from './codepoint-allocator';

export function generateCSS(
  icons: IconGlyph[],
  project: Project,
  codepointMap: Map<string, number>
): string {
  const { fontFamily, prefix } = project;

  const lines: string[] = [];

  // @font-face declaration
  lines.push(`@font-face {
  font-family: '${fontFamily}';
  src: url('fonts/${fontFamily}.woff2') format('woff2'),
       url('fonts/${fontFamily}.woff') format('woff'),
       url('fonts/${fontFamily}.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: block;
}

[class^="${prefix}-"], [class*=" ${prefix}-"] {
  font-family: '${fontFamily}' !important;
  speak: never;
  font-style: normal;
  font-weight: normal;
  font-variant: normal;
  text-transform: none;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
`);

  // Individual icon classes
  for (const icon of icons) {
    const codepoint = codepointMap.get(icon.id);
    if (codepoint === undefined) continue;
    lines.push(`.${prefix}-${icon.name}:before {
  content: "\\${formatCodepoint(codepoint)}";
}
`);
  }

  return lines.join('\n');
}