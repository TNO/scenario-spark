import m from 'mithril';
import { MeiosisComponent, t } from '../../services';
import { ID, Narrative, ScenarioComponent } from '../../models';
import {
  effectiveSelection,
  joinListWithAnd,
  parseTemplateLine,
  TemplateLine,
  visibleTemplateLines,
} from '../../utils';

// Define interfaces for our data structure
export type KeyDriver = {
  key: string;
  possibleValues: string[];
  selectedValue: string;
};

export type ScenarioParagraphAttrs = {
  template: string;
  className?: string;
};

// Render the (Markdown-styled) segments of a line, replacing placeholders with the selected values
const renderSegments = (
  { segments }: TemplateLine,
  keyDrivers: ScenarioComponent[] = [],
  components: { [key: ID]: ID[] } = {}
): Array<string | m.Vnode> => {
  const lookup = keyDrivers.reduce((acc, cur) => {
    acc[cur.id] = cur;
    return acc;
  }, {} as Record<ID, ScenarioComponent>);

  return segments.map(({ text, placeholder, bold, italic }) => {
    let node: string | m.Vnode = text;
    if (placeholder) {
      const c = lookup[text];
      if (c) {
        const labels = (c.values || [])
          .filter((v) => (components[c.id] || []).includes(v.id))
          .map((v) => v.label);
        // Manual components (e.g. measures) may still be empty
        const resolvedLabel = labels.length
          ? joinListWithAnd(labels, t('AND'), '', false)
          : ' ... ';
        node = m('strong', resolvedLabel);
      }
    } else if (bold) {
      node = m('strong', node);
    }
    return italic ? m('em', node) : node;
  });
};

// The main component
export const ScenarioParagraph: MeiosisComponent<
  ScenarioParagraphAttrs
> = () => {
  return {
    view: ({ attrs }) => {
      const {
        template,
        state: { model, curNarrative = {} as Narrative },
        className,
      } = attrs;
      const {
        scenario: { components: modelComps = [] },
      } = model;

      const components = effectiveSelection(model.scenario, curNarrative);
      const extractIds = /\{(\d+)\}/g;
      const idBasedTemplate = template
        .split(extractIds)
        .map((t) =>
          t?.replace(/^\d+$/, (i) =>
            +i <= modelComps.length
              ? `{${modelComps[+i - 1].id}}`
              : `??? ${i} ???`
          )
        )
        .join('');
      const lines = idBasedTemplate
        .split(/\n/g)
        .map((t) => t.trim())
        .filter(Boolean);
      const parsed = visibleTemplateLines(model.scenario, lines, components).map(
        parseTemplateLine
      );
      const blocks: m.Vnode[] = [];
      parsed.forEach((line, i) => {
        if (line.block === 'li') {
          if (i > 0 && parsed[i - 1].block === 'li') return;
          const items: TemplateLine[] = [];
          for (let j = i; j < parsed.length && parsed[j].block === 'li'; j++) items.push(parsed[j]);
          blocks.push(
            m(
              'ul.scenario-paragraph.scenario-list',
              { className },
              items.map((item) => m('li', renderSegments(item, modelComps, components)))
            )
          );
        } else if (line.block === 'p') {
          blocks.push(
            m('.scenario-paragraph', { className }, renderSegments(line, modelComps, components))
          );
        } else {
          blocks.push(
            m(
              `${line.block}.scenario-heading`,
              { className },
              renderSegments(line, modelComps, components)
            )
          );
        }
      });
      return blocks;
    },
  };
};
