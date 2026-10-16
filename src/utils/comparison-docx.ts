import type { ComparisonExport, ExportCell } from './decision';

/** Landscape page with narrow margins, as the comparison tables are wide. */
export const comparisonPageProperties = {
  page: {
    size: { orientation: 'landscape' as const },
    margin: { top: 720, right: 720, bottom: 720, left: 720 },
  },
};

/**
 * Word content (docx paragraphs and tables) of the decision-support comparison, rendered from
 * the plain blocks of `buildComparisonExport`, starting with its title.
 * `riskColors` are the background colours of risk levels 0-4 (hex, with or without `#`).
 */
export const comparisonChildren = async (data: ComparisonExport, riskColors: string[] = []) => {
  const {
    AlignmentType,
    HeadingLevel,
    Paragraph,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
  } = await import('docx');

  const clean = (input: string) => input.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
  const cellText = (cell: ExportCell) => (typeof cell === 'string' ? cell : cell.text);
  const fill = (risk?: number) => (risk === undefined ? undefined : riskColors[risk]?.replace('#', ''));
  const lines = (text: string, bold = false, color?: string) =>
    clean(text)
      .split('\n')
      .map((line) => new Paragraph({ children: [new TextRun({ text: line, bold, color })] }));

  const children: Array<InstanceType<typeof Paragraph> | InstanceType<typeof Table>> = [
    new Paragraph({
      text: clean(data.title),
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
    }),
  ];

  for (const block of data.blocks) {
    switch (block.kind) {
      case 'heading':
        children.push(
          new Paragraph({
            text: clean(block.text),
            heading: block.level === 1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 80 },
          }),
        );
        break;
      case 'paragraph':
        children.push(
          new Paragraph({
            children: [new TextRun({ text: clean(block.text), italics: block.italic })],
            spacing: { after: 120 },
          }),
        );
        break;
      case 'list':
        children.push(
          ...block.items.map(
            (item) => new Paragraph({ text: clean(item), bullet: { level: 0 }, spacing: { after: 40 } }),
          ),
        );
        break;
      case 'table': {
        const columns = block.header.length;
        children.push(
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                tableHeader: true,
                children: block.header.map(
                  (text) => new TableCell({ children: lines(text, true, 'FFFFFF'), shading: { fill: 'FF7800' } }),
                ),
              }),
              ...block.rows.map((row) =>
                row.group
                  ? new TableRow({
                      children: [
                        new TableCell({
                          children: lines(cellText(row.cells[0] || ''), true),
                          columnSpan: columns,
                          shading: { fill: 'EEEEEE' },
                        }),
                      ],
                    })
                  : new TableRow({
                      children: Array.from({ length: columns }, (_, i) => {
                        const cell = row.cells[i] ?? '';
                        const shade = fill(typeof cell === 'string' ? undefined : cell.risk);
                        return new TableCell({
                          children: lines(cellText(cell), i === 0),
                          ...(shade ? { shading: { fill: shade } } : {}),
                        });
                      }),
                    }),
              ),
            ],
          }),
          new Paragraph({ text: '', spacing: { after: 120 } }),
        );
        break;
      }
    }
  }

  return children;
};

/** Word document (docx) of the decision-support comparison, see `comparisonChildren`. */
export const comparisonDocument = async (data: ComparisonExport, riskColors: string[] = []) => {
  const { Document } = await import('docx');
  return new Document({
    title: data.title.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ''),
    sections: [{ properties: comparisonPageProperties, children: await comparisonChildren(data, riskColors) }],
  });
};
