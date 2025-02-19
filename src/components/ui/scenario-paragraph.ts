import m from 'mithril';
import { MeiosisComponent, t } from '../../services';
import { ID, Narrative, ScenarioComponent } from '../../models';
import { joinListWithAnd } from '../../utils';

// Define interfaces for our data structure
export type KeyDriver = {
  key: string;
  possibleValues: string[];
  selectedValue: string;
};

export type ScenarioParagraphAttrs = {
  template: string;
};

// Helper function to replace placeholders with select elements
const replacePlaceholders = (
  text: string,
  keyDrivers: ScenarioComponent[] = [],
  components: { [key: ID]: ID[] } = {}
): Array<string | m.Vnode> => {
  const lookup = keyDrivers.reduce((acc, cur, idx) => {
    acc[cur.id] = idx;
    return acc;
  }, {} as Record<ID, number>);

  // console.log(keyDrivers.map((k) => [k.label, k.id]).join('\n'));

  const parseTextWithPlaceholders = (input: string): string[] => {
    const regex = /({[^}]+})|([^{}]+)/g;
    const matches = input.match(regex);
    return matches ? matches : [];
  };

  const parts = parseTextWithPlaceholders(text).map((s) => {
    if (s.startsWith('{') && s.endsWith('}')) {
      const id = s.substring(1, s.length - 1);
      const c = keyDrivers[lookup[id]];
      if (!c) return id;
      const resolvedLabel =
        c.values && components[c.id]
          ? `${joinListWithAnd(
              c.values
                .filter((v) => components[c.id].includes(v.id))
                .map((v) => v.label),
              t('AND'),
              '',
              false
            )}`
          : ' ... ';
      return m('strong', resolvedLabel);
    } else {
      return s;
    }
  });

  return parts;
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
      } = attrs;
      const {
        scenario: { components: modelComps = [] },
      } = model;

      const { components = {} } = curNarrative;
      const extractIds = /{(\d+)}/g;
      const idBasedTemplate = template
        .split(extractIds)
        .map((t) =>
          t.replace(/\d+/, (i) =>
            +i < modelComps.length
              ? `{${modelComps[+i - 1].id}}`
              : `??? ${i} ???`
          )
        )
        .join('');
      return idBasedTemplate
        .split(/\n/g)
        .map((t) => t.trim())
        .filter(Boolean)
        .map((t) =>
          m('.scenario-paragraph', [
            replacePlaceholders(t, modelComps, components),
          ])
        );
    },
  };
};
