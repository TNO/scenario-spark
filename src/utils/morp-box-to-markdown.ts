import { uniqueId } from 'mithril-materialized';
import { Category, Item, ScenarioComponent } from '../models';

export type KeyDriver = Item & {
  values: Item[];
};

/**
 * Converts a morphological box structure to a simplified markdown format
 * @param keyDrivers Array of key drivers with their variants
 * @returns Markdown string representation
 */
export const morphBoxToMarkdown = (
  category: Category,
  components: ScenarioComponent[]
): string => {
  const lines: string[] = [];
  const { label, componentIds = [] } = category;

  // Add header
  lines.push(`# ${label}`);
  lines.push('');

  componentIds
    .map((id) => components.find((c) => c.id === id))
    .filter(Boolean)
    .forEach((component, index) => {
      const { id, label, desc, values = [] } = component!;
      // Add key driver as a numbered heading with optional description
      const driverLine = `${index + 1}. ${label} [${id}]${
        desc ? `: ${desc}` : ''
      }`;
      lines.push(driverLine);

      // Add variants as bullet points
      values.forEach((v) => {
        const variantLine = `   - ${v.label} [${v.id}]${
          v.desc ? `: ${v.desc}` : ''
        }`;
        lines.push(variantLine);
      });

      lines.push('');
    });

  return lines.join('\n');
};

/**
 * Parses simplified markdown and converts it to a morphological box structure
 * @param markdown Markdown string representation of a morphological box
 * @returns Array of key drivers with their variants
 */
export const markdownToMorphBox = (
  markdown: string
): { label?: string; desc?: string; keyDrivers: KeyDriver[] } => {
  let catLabel: string | undefined = undefined;
  let catDesc: string | undefined = undefined;
  const keyDrivers: KeyDriver[] = [];
  const lines = markdown.split('\n');

  let currentDriver: KeyDriver | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\*{2,3}/g, '').trim();

    console.log(line);

    // Skip empty lines
    if (line === '') {
      continue;
    }

    if (line.startsWith('# ')) {
      const titleMatch = line.match(/^#\s+(.+?)(?:\s*:\s*(.+))?$/);
      if (titleMatch) {
        catLabel = titleMatch[1];
        catDesc = titleMatch[2];
      }
    }

    // Check if this is a key driver (numbered list item)
    const driverMatch = line.match(
      /^(\d+)\.\s+(.+?)(?:\s+\[([^\]]+)\])?(?:\s*:\s*(.+))?$/
    );
    if (driverMatch) {
      // Save previous driver if exists
      if (currentDriver) {
        keyDrivers.push(currentDriver);
      }

      // Extract driver info
      const label = driverMatch[2].trim();
      const id = driverMatch[3] || uniqueId();
      const desc = driverMatch[4];

      currentDriver = {
        id,
        label,
        desc,
        values: [],
      };
    }
    // Check if this is a variant (bullet point)
    else if (line.startsWith('-') && currentDriver) {
      // Extract variant info from bullet point
      // Format: - [id] label: description
      const variantMatch = line.match(
        /^-\s+(.+?)(?:\s+\[([^\]]+)\])?(?:\s*:\s*(.+))?$/
      );

      if (variantMatch) {
        const id = variantMatch[2] || uniqueId();
        const label = variantMatch[1].trim();
        const desc = variantMatch[3];

        currentDriver.values.push({
          id,
          label,
          desc,
        });
      }
    }
  }

  // Add the last driver if it exists
  if (currentDriver) {
    keyDrivers.push(currentDriver);
  }

  return { label: catLabel, desc: catDesc, keyDrivers };
};

// /**
//  * Demo function to show how the converters work with the simplified format
//  */
// function demo() {
//   // Sample morphological box
//   const morphBox: KeyDriver[] = [
//     {
//       id: "energy",
//       label: "Energy Source",
//       desc: "Primary energy source for the system",
//       variants: [
//         { id: "e1", label: "Solar", desc: "Photovoltaic panels" },
//         { id: "e2", label: "Wind", desc: "Wind turbines" },
//         { id: "e3", label: "Fossil", desc: "Petroleum-based fuels" }
//       ]
//     },
//     {
//       id: "storage",
//       label: "Storage Method",
//       variants: [
//         { id: "s1", label: "Battery", desc: "Lithium-ion battery packs" },
//         { id: "s2", label: "Hydrogen", desc: "Hydrogen fuel cells" },
//         { id: "s3", label: "Mechanical", desc: "Flywheels or pumped storage" }
//       ]
//     }
//   ];

//   // Convert to markdown
//   const markdown = morphBoxToMarkdown(morphBox);
//   console.log("MARKDOWN OUTPUT:");
//   console.log(markdown);

//   // Sample markdown with missing IDs
//   const sampleMarkdown = `
// # Morphological Box

// 1. Energy Source: Primary energy source for the system
//    - Solar: Photovoltaic panels
//    - Wind: Wind turbines
//    - Fossil: Petroleum-based fuels

// 2. Storage Method
//    - Battery: Lithium-ion battery packs
//    - [s2] Hydrogen: Hydrogen fuel cells
//    - Mechanical
//   `;

//   // Convert markdown to object
//   const parsedMorphBox = markdownToMorphBox(sampleMarkdown);
//   console.log("\nPARSED OBJECT:");
//   console.log(JSON.stringify(parsedMorphBox, null, 2));

//   // Convert this back to markdown to see the round trip with auto-generated IDs
//   const roundTripMarkdown = morphBoxToMarkdown(parsedMorphBox);
//   console.log("\nROUND TRIP MARKDOWN:");
//   console.log(roundTripMarkdown);
// }

// // Export the functions
// export {
//   morphBoxToMarkdown,
//   markdownToMorphBox,
//   demo
// };
