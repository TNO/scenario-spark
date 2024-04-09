import m from 'mithril';
import { padLeft, uniqueId } from 'mithril-materialized';
import { render } from 'mithril-ui-form';
import {
  ContextType,
  DataModel,
  ID,
  Inconsistencies,
  Narrative,
  OldDataModel,
  OsmTypeList,
  Scenario,
  ScenarioComponent,
  thresholdColors,
} from '../models';
import { t } from '../services';

export const LANGUAGE = 'SG_LANGUAGE';
export const SAVED = 'SG_MODEL_SAVED';

const supRegex = /\^([^_ ]+)(_|$|\s)/g;
const subRegex = /\_([^\^ ]+)(\^|$|\s)/g;

/** Expand markdown notation by converting A_1 to subscript and x^2 to superscript. */
export const subSup = (s: string) =>
  s
    ? s.replace(supRegex, `<sup>$1</sup>`).replace(subRegex, `<sub>$1</sub>`)
    : s;

export const capitalize = (s?: string) =>
  s && s.charAt(0).toUpperCase() + s.slice(1);

/**
 * Debounce function wrapper, i.e. between consecutive calls of the wrapped function,
 * there will be at least TIMEOUT milliseconds.
 * @param func Function to execute
 * @param timeout Timeout in milliseconds
 * @returns
 */
export const debounce = (func: (...args: any) => void, timeout: number) => {
  let timer: number;
  return (...args: any) => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      func(...args);
    }, timeout);
  };
};

export const formatDate = (date: number | Date = new Date()) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${padLeft(d.getMonth() + 1)}-${padLeft(
    d.getDate()
  )}`;
};

/**
 * Get a color that is clearly visible against a background color
 * @param backgroundColor Background color, e.g. #99AABB
 * @returns
 */
export const getTextColorFromBackground = (backgroundColor?: string) => {
  if (!backgroundColor) {
    return 'black-text';
  }
  const c = backgroundColor.substring(1); // strip #
  const rgb = parseInt(c, 16); // convert rrggbb to decimal
  const r = (rgb >> 16) & 0xff; // extract red
  const g = (rgb >> 8) & 0xff; // extract green
  const b = (rgb >> 0) & 0xff; // extract blue

  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b; // per ITU-R BT.709

  return luma < 105 ? 'white-text' : 'black-text';
};

type Option<T> = {
  id: T;
  label: string;
  title?: string;
};

export const getOptionsLabel = <T>(
  options: Array<Option<T>>,
  id?: T | T[],
  showTitle = true
) => {
  if (!id) {
    return '';
  }
  const print = (o: Option<T>) =>
    showTitle
      ? `${o.label}${o.title ? ` (${o.title.replace(/\.\s*$/, '')})` : ''}`
      : o.label;
  if (id instanceof Array) {
    return options
      .filter((o) => id.indexOf(o.id) >= 0)
      .map((o) => print(o))
      .join(', ');
  }
  const found = options.filter((o) => o.id === id).shift();
  return found ? print(found) : '';
};

/** Join a list of items with a comma, and use AND for the last item in the list. */
export const joinListWithAnd = (
  arr: string[] = [],
  and = 'and',
  prefix = ''
) => {
  const terms = arr.filter((term) => term);
  return terms.length === 0
    ? ''
    : prefix +
        (terms.length === 1
          ? terms[0]
          : `${terms
              .slice(0, terms.length - 1)
              .map((t, i) =>
                i === 0 || typeof t === 'undefined' ? t : t.toLowerCase()
              )
              .join(', ')} ${and} ${terms[terms.length - 1].toLowerCase()}`);
};

/** Convert markdown text to HTML */
export const markdown2html = (markdown = '') =>
  m.trust(render(markdown, true, true));

export const isUnique = <T>(item: T, pos: number, arr: T[]) =>
  arr.indexOf(item) == pos;

/** Generate an array of numbers, from start till end, with optional step size. */
export const generateNumbers = (
  start: number,
  end: number,
  step: number = 1
): number[] => {
  if (start > end) {
    throw new Error(
      'Start number must be less than or equal to the end number.'
    );
  }

  if (step <= 0) {
    throw new Error('Step size must be a positive number.');
  }

  const length = Math.floor((end - start) / step) + 1;
  return Array.from({ length }, (_, index) => start + index * step);
};

export const getRandomValue = <T>(array: T[]): T | undefined => {
  if (array.length === 0) {
    return undefined;
  }

  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
};

/**
 * Deep copy function for TypeScript.
 * @param T Generic type of target/copied value.
 * @param target Target value to be copied.
 * @see Source project, ts-deepcopy https://github.com/ykdr2017/ts-deepcopy
 * @see Code pen https://codepen.io/erikvullings/pen/ejyBYg
 */
export const deepCopy = <T>(target: T): T => {
  if (target === null) {
    return target;
  }
  if (target instanceof Date) {
    return new Date(target.getTime()) as any;
  }
  if (target instanceof Array) {
    const cp = [] as any[];
    (target as any[]).forEach((v) => {
      cp.push(v);
    });
    return cp.map((n: any) => deepCopy<any>(n)) as any;
  }
  if (typeof target === 'object') {
    const cp = { ...(target as { [key: string]: any }) } as {
      [key: string]: any;
    };
    Object.keys(cp).forEach((k) => {
      cp[k] = deepCopy<any>(cp[k]);
    });
    return cp as T;
  }
  return target;
};

/** Compute a contrasting background color */
export const contrastingColor = (backgroundColor: string) => {
  const backgroundRgb = [
    parseInt(backgroundColor[1] + backgroundColor[2], 16),
    parseInt(backgroundColor[3] + backgroundColor[4], 16),
    parseInt(backgroundColor[5] + backgroundColor[6], 16),
  ];
  const luminance =
    0.2126 * backgroundRgb[0] +
    0.7152 * backgroundRgb[1] +
    0.0722 * backgroundRgb[2];

  // If the background is dark, use white text.
  if (luminance < 20) {
    return '#ffffff';
  }

  // If the background is light, use black text.
  return '#000000';
};

export const convertFromOld = (old: OldDataModel): DataModel => {
  return Object.keys(old).reduce(
    (acc, cur) => {
      if (cur === 'scenarios') {
        // Parse scenarios
        const scenario = old[cur].current;
        acc.scenario.id = scenario.id;
        acc.scenario.label = scenario.name;
        acc.scenario.desc = scenario.desc;
        acc.scenario.hideInconsistentValues = true;
        acc.scenario.inconsistencies = scenario.inconsistencies.reduce(
          (acc, cur) => {
            const {
              ids: [from, to],
              type,
            } = cur;
            if (!acc[from]) acc[from] = {};
            if (!acc[to]) acc[to] = {};
            const value = type === 'totally' ? true : false;
            acc[from][to] = value;
            acc[to][from] = value;
            return acc;
          },
          {} as Inconsistencies
        );
        acc.scenario.narratives = scenario.narratives.map(
          ({ id, name, components, narrative, included }) => ({
            id,
            label: name,
            components: Object.keys(components).reduce((acc, key) => {
              acc[key] = [components[key]];
              return acc;
            }, {} as { [key: ID]: ID[] }),
            desc: narrative,
            included,
            saved: true,
          })
        );
        acc.scenario.categories = Object.keys(scenario.categories).map(
          (key) => ({
            id: key,
            label: key,
            componentIds: scenario.categories[key],
          })
        );
      } else {
        // Parse components
        if (!acc.scenario.components) acc.scenario.components = [];
        const componentValues = old[cur].list;
        const contexts = componentValues.reduce((acc, cur) => {
          if (cur.context && cur.context.type) {
            if (cur.context.type === 'LOCATION' && acc.indexOf('location') <= 0)
              acc.push('location');
            else if (
              cur.context.type === 'LOCATIONTYPE' &&
              acc.indexOf('locationType') <= 0
            )
              acc.push('locationType');
          }
          return acc;
        }, [] as ContextType[]);
        acc.scenario.components.push({
          id: cur,
          label: t('COMP', cur.toUpperCase() as any),
          contexts,
          values: componentValues.map(({ name, id, desc, context }) => {
            const newContext = context
              ? context.type === 'LOCATION'
                ? 'location'
                : context.type === 'LOCATIONTYPE'
                ? 'locationType'
                : 'none'
              : undefined;
            const locationType =
              context && context.type === 'LOCATION'
                ? context.data.NAME
                  ? 'name'
                  : context.data.COORDINATES
                  ? 'coords'
                  : undefined
                : undefined;
            const [lat, lon] =
              locationType === 'coords' && context!.data.COORDINATES
                ? context!.data.COORDINATES.split(/,/).map((n) => +n)
                : [undefined, undefined];
            const locationTypeType =
              context && context.type === 'LOCATIONTYPE'
                ? OsmTypeList.indexOf(Object.keys(context.data).shift()) >= 0
                  ? 'list'
                  : 'keyValue'
                : undefined;
            const osmTypeId =
              locationTypeType === 'list'
                ? Object.keys(context!.data).shift()
                : undefined;
            const keyValue =
              locationTypeType === 'keyValue'
                ? Object.entries(context!.data).shift()
                : undefined;
            const [key, value] = keyValue || [undefined, undefined];
            return {
              id,
              label: name,
              desc,
              context: newContext,
              location:
                context && context.type === 'LOCATION'
                  ? context.data.NAME
                  : undefined,
              locationType,
              locationTypeType,
              lat,
              lon,
              osmTypeId,
              key,
              value,
            };
          }),
        });
        acc.scenario.thresholdColors = thresholdColors;
        if (acc.scenario.categories) {
          let order = 1;
          const compIds = acc.scenario.categories
            .filter((c) => c.componentIds)
            .reduce((acc, cur) => {
              cur.componentIds?.forEach((c) => (acc[c] = order++));
              return acc;
            }, {} as { [key: ID]: number });
          acc.scenario.components = acc.scenario.components.map((c) => ({
            ...c,
            order: compIds[c.id],
          }));
          acc.scenario.components.sort((a, b) =>
            a.order! > b.order! ? 1 : -1
          );
        }
      }
      return acc;
    },
    {
      scenario: {} as Scenario,
      version: 1,
      lastUpdata: Date.now(),
    } as DataModel
  );
};

export const modelToSaveName = (model: DataModel, narrativeName?: string) => {
  let name = model.scenario?.label || 'scenario_spark';
  if (narrativeName) {
    name += `_${narrativeName}`;
  }
  return `${name.replace(/\s/g, '_')}_v${padLeft(
    model.version || 1,
    3
  )}_${formatDate()}`;
};

export const generateNarrative = (
  scenario: Scenario,
  locked: Record<ID, ID[]> = {}
) => {
  const { categories, components, inconsistencies } = scenario;

  let tries = 0;
  const generate = () => {
    const chosen = { ...locked } as Record<ID, ID[]>;
    for (const category of categories) {
      const catComps = components
        .filter(
          (c) => category.componentIds && category.componentIds.includes(c.id)
        )
        .map((c) => {
          const inc = c.values
            ? c.values.reduce((acc, cur) => {
                return (
                  acc +
                  (inconsistencies[cur.id]
                    ? Object.keys(inconsistencies[cur.id]).length
                    : 0)
                );
              }, 0)
            : 0;
          return { ...c, inc };
        })
        .sort((a, b) => (a.inc > b.inc ? -1 : 1));
      const excluded: ID[] = [];
      for (const catComp of catComps) {
        if (chosen.hasOwnProperty(catComp.id)) {
          const chosenValue = chosen[catComp.id];
          if (chosenValue && chosenValue.length) {
            if (chosenValue.some((v) => excluded.includes(v))) return false;
            chosenValue.forEach((v) => {
              inconsistencies[v] &&
                Object.keys(inconsistencies[v]).forEach(
                  (id) => inconsistencies[v][id] && excluded.push(id)
                );
            });
          }
          continue;
        }
        const valuesToChooseFrom =
          catComp.values &&
          catComp.values
            .map(({ id }) => id)
            .filter((id) => !excluded.includes(id));
        if (!valuesToChooseFrom || valuesToChooseFrom.length === 0)
          return false;
        const v = getRandomValue(valuesToChooseFrom);
        if (v) {
          inconsistencies[v] &&
            Object.keys(inconsistencies[v]).forEach(
              (id) => inconsistencies[v][id] && excluded.push(id)
            );
          chosen[catComp.id] = [v];
        } else {
          return false;
        }
      }
    }
    return chosen;
  };

  do {
    const components = generate();
    if (components) {
      const narrative = {
        id: uniqueId(),
        components,
        included: false,
      } as Narrative;
      return narrative;
    }
    tries++;
  } while (tries < 100);
  return false;
};

export const scrollToSection = (e: MouseEvent, id: string): void => {
  e.preventDefault();
  const element = document.getElementById(id);

  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  } else {
    console.log(`Element with id ${id} not found.`);
  }
};

export const scrollToTop = (): void => {
  window.scrollTo({
    top: 0,
    behavior: 'smooth',
  });
};

export const validateNarrative = (
  n: Narrative,
  components: ScenarioComponent[]
) => {
  const { components: narrativeComps, ...attrs } = n;
  const newNarrative = { components: {}, ...attrs } as Narrative;
  components
    .filter((c) => narrativeComps.hasOwnProperty(c.id))
    .forEach((c) => {
      newNarrative.components[c.id] = narrativeComps[c.id].filter((id) =>
        c.values?.find((v) => v.id === id)
      );
    });
  return newNarrative;
};

export const narrativesToOptions = (narratives: Narrative[]) =>
  narratives
    .map((n) => ({
      ...n,
      group: n.included ? t('GROUP', 'SELECTED') : t('GROUP', 'UNSELECTED'),
    }))
    .sort((a, b) =>
      a.included && b.included
        ? (a.label || '').localeCompare(b.label)
        : a.included
        ? -1
        : 1
    );
