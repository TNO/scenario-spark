import m from 'mithril';
import {
  Dashboards,
  ContextualItem,
  ScenarioComponent,
  ID,
  ContextType,
  Color,
  ThresholdColor,
  Scenario,
  Narrative,
  Category,
} from '../models';
import {
  MeiosisComponent,
  mutateScenarioComponent,
  setPage,
  i18n,
  t,
  moveScenarioComponent,
} from '../services';
import {
  FlatButton,
  ModalPanel,
  Tabs,
  ThemeManager,
  toast,
} from 'mithril-materialized';
import {
  FormAttributes,
  LayoutForm,
  render,
  SlimdownView,
  UIForm,
} from 'mithril-ui-form';
import { capitalize, computeCompColor, toDarkThemeColor } from '../utils';
import { LegendComponent } from './ui';

const BoxItem: MeiosisComponent<{
  id: ID;
  item: ContextualItem;
  contexts?: ContextType[];
  form: UIForm<ContextualItem>;
  color: [Color, Color];
}> = () => {
  let obj: ContextualItem;
  let contextAwareForm: UIForm<ContextualItem>;
  let editorOpen = false;

  return {
    oninit: ({ attrs: { item, form, contexts } }) => {
      const hasContext =
        contexts && contexts.length > 0 && contexts[0] !== 'none';
      contextAwareForm = form
        .filter((i) => (i.id === 'context' ? hasContext : true))
        .map((i) =>
          i.id === 'context' &&
          hasContext &&
          i.options &&
          i.options instanceof Array
            ? {
                ...i,
                options: i.options.filter(
                  (o) =>
                    o.id === 'none' ||
                    contexts.indexOf(o.id as ContextType) >= 0
                ),
              }
            : i
        );
      obj = { ...item };
    },
    view: ({ attrs }) => {
      const { item, id, color } = attrs;
      return m(
        'li.kanban-item.card.widget[draggable=true]',
        {
          key: id,
          id: `ki_${item.id}`,
          // style: {
          //   backgroundColor: color[0],
          //   color: color[1],
          // },
          ondragstart: (ev: DragEvent) => {
            ev.dataTransfer?.setData(id, JSON.stringify([id, item.id]));
          },
          ondragover: (ev: DragEvent) => {
            const allowed = ev.dataTransfer?.types.includes(id.toLowerCase());
            if (allowed) ev.preventDefault();
          },
          ondrop: (ev: DragEvent) => {
            ev.preventDefault();
            const data = ev.dataTransfer?.getData(id);
            if (!data) return;
            const [_, itemId] = JSON.parse(data) as [string, string];
            const dropTarget = ev.currentTarget as HTMLDataListElement;
            if (!itemId || !dropTarget || itemId === item.id) return;
            if (!dropTarget) return;
            const dropY = ev.clientY - dropTarget.getBoundingClientRect().top;
            const dropHeight = dropTarget.clientHeight;
            const moveBefore = dropY <= dropHeight / 2;
            moveScenarioComponent(attrs, id, itemId, item.id, moveBefore);
          },
        },
        [
          m(
            '.card-content',
            {
              style: {
                backgroundColor: color[0],
              },
              onmouseenter: () => {
                const activeTooltip = `${item.label || ''}${
                  item.desc ? `: ${item.desc}` : ''
                }`;
                attrs.update({
                  activeTooltip,
                });
              },
              onmouseleave: () => {
                attrs.update({
                  activeTooltip: undefined,
                });
              },
            },
            [
              m(
                'span.card-title',
                { style: { color: color[1] } },
                capitalize(item.label)
              ),
              // item.desc && m('span.card-desc', item.desc),
              m(FlatButton, {
                className: 'top-right widget-link',
                iconName: 'edit',
                iconClass: 'no-gutter',
                onclick: () => {
                  editorOpen = true;
                },
              }),
            ]
          ),
          m(ModalPanel, {
            id: `modal_${item.id}`,
            title: t('EDIT_COMPONENT'),
            isOpen: editorOpen,
            fixedFooter: true,
            onClose: () => (editorOpen = false),
            description: m(
              '.row',
              m(LayoutForm, {
                form: contextAwareForm,
                obj,
                i18n: i18n.i18n,
              } as FormAttributes<ContextualItem>)
            ),
            // options: { opacity: 0.7 },
            buttons: [
              {
                label: t('CANCEL'),
              },
              {
                label: t('DELETE'),
                onclick: () => {
                  mutateScenarioComponent(attrs, id, obj, 'delete');
                },
              },
              {
                label: t('OK'),
                onclick: () => {
                  mutateScenarioComponent(attrs, id, obj, 'update');
                },
              },
            ],
          }),
        ]
      );
    },
  };
};

const BoxHeader: MeiosisComponent<{
  sc: ScenarioComponent;
  form: UIForm<ContextualItem>;
}> = () => {
  let obj = {} as ContextualItem;
  let addComponent = false;
  return {
    view: ({ attrs }) => {
      const { sc, form } = attrs;
      const { id } = sc;

      return m('li.kanban-header.widget', { key: 'header' }, [
        m(
          '.span.title.truncate.left.ml10',
          {
            onmouseenter: sc.desc
              ? () => {
                  attrs.update({
                    activeTooltip: `${sc.label || ''}: ${sc.desc}`,
                  });
                }
              : undefined,
            onmouseleave: sc.desc
              ? () => {
                  attrs.update({
                    activeTooltip: undefined,
                  });
                }
              : undefined,
          },
          sc.label
        ),
        m(FlatButton, {
          className: 'widget-link',
          iconName: 'add',
          iconClass: 'right',
          // modalId: sc.id,
          i18n: i18n.i18n,
          onclick: () => (addComponent = true),
        }),
        m(ModalPanel, {
          id: sc.id,
          title: t('ADD_COMPONENT'),
          fixedFooter: true,
          isOpen: addComponent,
          onClose: () => (addComponent = false),
          description: m(
            '.row',
            m(LayoutForm, {
              form,
              obj,
              i18n: i18n.i18n,
            } as FormAttributes<ContextualItem>)
          ),
          // options: { opacity: 0.7 },
          buttons: [
            {
              label: t('CANCEL'),
            },
            {
              label: t('OK'),
              onclick: () => {
                const item = { ...obj };
                obj = {} as ContextualItem;
                mutateScenarioComponent(attrs, id, item, 'create');
              },
            },
          ],
        }),
      ]);
    },
  };
};

const BoxRow: MeiosisComponent<{
  sc: ScenarioComponent;
  form: UIForm<ContextualItem>;
  compColor: { [key: ID]: [Color, Color] };
}> = () => {
  return {
    view: ({ attrs }) => {
      const { sc, form, compColor } = attrs;
      return m('li', { key: sc.id }, [
        m(
          'ul.kanban-row',
          m(BoxHeader, { ...attrs, sc, form }),
          sc.values?.map((c) =>
            m(BoxItem, {
              key: c.id,
              ...attrs,
              id: sc.id,
              contexts: sc.contexts,
              item: c,
              form,
              color: compColor[c.id] || compColor['OTHER'],
            })
          )
        ),
      ]);
    },
  };
};

const BoxView: MeiosisComponent<{
  categoryId: number;
  form: UIForm<ContextualItem>;
  compColor: { [key: ID]: [Color, Color] };
}> = () => {
  return {
    view: ({ attrs }) => {
      const {
        form,
        categoryId,
        compColor,
        state: { model },
      } = attrs;
      const { scenario } = model;
      const { categories, components: components } = scenario;
      const category = categories[categoryId];
      const scs = components.filter(
        (c) => category.componentIds && category.componentIds.indexOf(c.id) >= 0
      );

      return m('ul.kanban', [
        // m(
        // '.kanban-row',
        scs.map((sc) => m(BoxRow, { ...attrs, sc, form, compColor })),
        // ),
      ]);
    },
  };
};

export const CreateBoxPage: MeiosisComponent = () => {
  let tooltip = '';
  let tmpTooltip = '';
  let fadeOut = false;
  let timer: number | undefined;

  function showTooltip(newText: string) {
    if (tmpTooltip === newText || tooltip === newText) return; // same text, no change
    tmpTooltip = newText;
    // fade out old
    fadeOut = true;
    m.redraw();

    // after fade duration, swap text + fade back in
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      tooltip = newText;
      fadeOut = false;
      m.redraw();
    }, 200); // matches .popupContent fade duration
  }

  function hideTooltip() {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      tooltip = '';
      tmpTooltip = '';
      fadeOut = false;
      m.redraw();
    }, 200); // matches .popupContent fade duration
  }

  const form = [
    { id: 'id', autogenerate: 'id' },
    { id: 'label', type: 'text', label: t('NAME') },
    { id: 'desc', type: 'textarea', label: t('DESCRIPTION') },
    // {
    //   id: 'context',
    //   type: 'select',
    //   label: t('CONTEXT'),
    //   value: 'none',
    //   options: contextTypeOptions(t),
    // },
    // {
    //   id: 'locationType',
    //   show: ['context=location'],
    //   type: 'select',
    //   label: t('LOCATION_TYPE'),
    //   className: 'col s6',
    //   options: [
    //     { id: 'name', label: t('NAME') },
    //     { id: 'coords', label: t('COORDINATES') },
    //   ],
    // },
    // {
    //   id: 'location',
    //   show: ['context=location & locationType=name'],
    //   type: 'text',
    //   className: 'col s6',
    //   label: t('LOCATION_NAME'),
    // },
    // {
    //   id: 'lat',
    //   show: ['context=location & locationType=coords'],
    //   type: 'number',
    //   className: 'col s3',
    //   label: t('LATITUDE'),
    // },
    // {
    //   id: 'lon',
    //   show: ['context=location & locationType=coords'],
    //   type: 'number',
    //   className: 'col s3',
    //   label: t('LONGITUDE'),
    // },
    // {
    //   id: 'locationTypeType',
    //   show: ['context=locationType'],
    //   type: 'select',
    //   label: t('LOCATION_TYPE'),
    //   className: 'col s6',
    //   options: [
    //     { id: 'list', label: t('PICK_FROM_LIST') },
    //     { id: 'keyValue', label: t('ENTER_KEY_VALUE') },
    //   ],
    // },
    // {
    //   id: 'osmTypeId',
    //   show: ['context=locationType & locationTypeType=list'],
    //   type: 'select',
    //   label: t('NAME'),
    //   className: 'col s6',
    //   options: OsmTypes.map(({ id, name }) => ({ id, label: name })),
    // },
    // {
    //   id: 'value',
    //   show: ['context=locationType & locationTypeType=keyValue'],
    //   type: 'text',
    //   className: 'col s3',
    //   label: t('KEY'),
    // },
    // {
    //   id: 'key',
    //   show: ['context=locationType & locationTypeType=keyValue'],
    //   type: 'text',
    //   className: 'col s3',
    //   label: t('VALUE'),
    // },
  ] as UIForm<ContextualItem>;
  let narrativeLength = 0;
  let compColor: { [key: ID]: [Color, Color] } = {};
  let themeThresholdColors: ThresholdColor[] = [];

  const setThresholdColors = (thc: ThresholdColor[]) => {
    if (!thc) return;
    if (ThemeManager.getEffectiveTheme() === 'light') {
      themeThresholdColors = [...thc];
    } else {
      themeThresholdColors = thc.map((c) => ({
        threshold: c.threshold,
        color: toDarkThemeColor(c.color),
      }));
    }
  };

  const copyMarkdownTable = (scenario: Scenario, categories: Category[]) => {
    let fragments: string[] = [];
    const includedNarratives = scenario.narratives.filter((n) => n.included);
    for (const category of categories) {
      const scenarioComponents = scenario.components.filter((c) =>
        category.componentIds?.includes(c.id)
      );
      const md = generateMorphologicalBoxMarkdown({
        components: scenarioComponents,
        narratives: includedNarratives,
        compColor, // your existing color map per ContextualItem.id
        includeDescriptions: false, // set true to append item descriptions
        // colorStyle: 'emoji', // or 'emoji'
        // resolveIds: (n, set) => [...], // optional: provide if your narrative shape is custom
      });
      fragments.push(md);
    }
    // const md = generateMorphologicalBoxMarkdown({
    //   components: scenario.components,
    //   narratives: scenario.narratives.filter((n) => n.included),
    //   compColor, // your existing color map per ContextualItem.id
    //   includeDescriptions: false, // set true to append item descriptions
    //   // colorStyle: 'emoji', // or 'emoji'
    //   // resolveIds: (n, set) => [...], // optional: provide if your narrative shape is custom
    // });

    // console.log(md);
    const md = fragments.join('\n\n');
    const html = render(md, true);

    navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([md], { type: 'text/plain' }),
      }),
    ]);
  };

  return {
    oninit: ({ attrs }) => {
      setPage(attrs, Dashboards.DEFINE_BOX);
    },
    view: ({ attrs }) => {
      const {
        activeTooltip,
        model: { scenario },
      } = attrs.state;
      if (activeTooltip) {
        showTooltip(activeTooltip);
      } else {
        hideTooltip();
      }
      const { categories, thresholdColors = [], narratives = [] } = scenario;
      setThresholdColors(thresholdColors);
      if (
        Object.keys(compColor).length === 0 ||
        narrativeLength !== narratives.length
      ) {
        narrativeLength = narratives.length;
        compColor = computeCompColor(narratives, themeThresholdColors);
      }
      return [
        m('.create-box-page', [
          m(FlatButton, {
            style: {
              marginTop: '20px',
              marginBottom: '-40px',
            },
            className: 'right',
            label: t('COPY_BOX', 'LABEL'),
            iconName: 'content_copy',
            title: t('COPY_BOX', 'TITLE'),
            onclick: () => {
              copyMarkdownTable(scenario, categories);
              toast({ html: t('COPY_BOX', 'TOAST') });
            },
          }),
          m(LegendComponent, { items: themeThresholdColors }),
          categories.length > 1 &&
          categories[0].componentIds &&
          categories[1].componentIds
            ? m(Tabs, {
                tabs: categories.map((c, categoryId) => ({
                  id: c.id,
                  title: c.label,
                  vnode: m(BoxView, {
                    ...attrs,
                    compColor,
                    categoryId,
                    form,
                  }),
                })),
              })
            : categories.length === 1 && categories[0].componentIds
            ? m(BoxView, { ...attrs, compColor, categoryId: 0, form })
            : m('.row.mt10', m('.col.s12', t('SPEC_CATS'))),
          tooltip &&
            m(
              '.popupContainer',
              {
                className: 'show',
              },
              m(
                '.popupContent.center',
                { class: fadeOut ? 'fade-out' : undefined },
                m(SlimdownView, { md: tooltip, removeParagraphs: true })
              )
            ),
        ]),
      ];
    },
  };
};

// export const generateMorphologicalBox = (
//   scs: ScenarioComponent[],
//   compColor: { [key: ID]: [Color, Color] },
//   withDesc: boolean = false
// ): string => {
//   // Collect headers
//   const headers = scs.map((sc) => sc.label);
//   const columns: (string | undefined)[][] = scs.map((sc) => {
//     const grouped: Record<string, ContextualItem[]> = {};
//     (sc.values || []).forEach((item) => {
//       if (!grouped[item.label]) grouped[item.label] = [];
//       grouped[item.label].push(item);
//     });

//     return Object.entries(grouped).map(([label, items]) => {
//       const first = items[0];
//       const [bg] = compColor[first.id] || ['#999', '#fff'];
//       const colorIcon = `![#${bg.replace(
//         '#',
//         ''
//       )}](https://via.placeholder.com/12/${bg.replace('#', '')}/000000?text=+)`;
//       const text = `${capitalize(label)} (${items.length}x)`;
//       return withDesc && first.desc
//         ? `${colorIcon} ${text} — ${first.desc}`
//         : `${colorIcon} ${text}`;
//     });
//   });

//   // Find the maximum column length
//   const maxRows = Math.max(...columns.map((c) => c.length));

//   // Build table rows
//   const headerRow = `| ${headers.join(' | ')} |`;
//   const sepRow = `| ${headers.map(() => '---').join(' | ')} |`;

//   const rows: string[] = [];
//   for (let i = 0; i < maxRows; i++) {
//     const row = columns.map((col) => col[i] || '');
//     rows.push(`| ${row.join(' | ')} |`);
//   }

//   return [headerRow, sepRow, ...rows].join('\n');
// };
// // import { ScenarioComponent, ContextualItem, ID, Color } from '../models';
// // import { capitalize } from '../utils';

// /**
//  * Generate a markdown table for a set of scenario components.
//  * @param scs The scenario components
//  * @param compColor A color lookup map for components
//  * @param withDesc Whether to include descriptions in the table
//  * @returns Markdown string
//  */
// export const generateMarkdownTable = (
//   scs: ScenarioComponent[],
//   compColor: { [key: ID]: [Color, Color] },
//   withDesc: boolean = false
// ): string => {
//   const headers = ['Component', 'Count', 'Color'].concat(
//     withDesc ? ['Description'] : []
//   );
//   const rows: string[] = [];

//   for (const sc of scs) {
//     const grouped: Record<string, ContextualItem[]> = {};
//     (sc.values || []).forEach((item) => {
//       if (!grouped[item.label]) grouped[item.label] = [];
//       grouped[item.label].push(item);
//     });

//     for (const [label, items] of Object.entries(grouped)) {
//       const first = items[0];
//       const [bg] = compColor[first.id] || ['#999', '#fff'];

//       // Color circle using markdown image hack
//       const colorIcon = `![#${bg.replace(
//         '#',
//         ''
//       )}](https://via.placeholder.com/15/${bg.replace('#', '')}/000000?text=+)`;

//       const row = [capitalize(label), `${items.length}x`, colorIcon].concat(
//         withDesc ? [first.desc || ''] : []
//       );

//       rows.push(`| ${row.join(' | ')} |`);
//     }
//   }

//   const headerRow = `| ${headers.join(' | ')} |`;
//   const sepRow = `| ${headers.map(() => '---').join(' | ')} |`;
//   return [headerRow, sepRow, ...rows].join('\n');
// };

// import { ScenarioComponent, ContextualItem, ID, Color } from '../models';
// import { capitalize } from '../utils';

// type AnyNarrative = Record<string, unknown>;
// type ResolveIds = (n: AnyNarrative, itemIdSet: Set<ID>) => ID[];

// interface MorphBoxOpts {
//   components: ScenarioComponent[];
//   narratives: AnyNarrative[];
//   compColor: Record<ID, [Color, Color]>;
//   includeDescriptions?: boolean; // default: false
//   colorStyle?: 'img' | 'emoji'; // default: 'img'
//   resolveIds?: ResolveIds; // optional custom resolver
// }

// /**
//  * Generate a Markdown "morphological box" table with per-item usage counts from narratives.
//  *
//  * - Columns are ScenarioComponents (their labels).
//  * - Each column lists its ContextualItems; each item shows a color icon + "Label (Nx)".
//  * - Counts are computed from how often each ContextualItem.id appears in the narratives.
//  */
// export const generateMorphologicalBoxMarkdown = ({
//   components,
//   narratives,
//   compColor,
//   includeDescriptions = false,
//   colorStyle = 'img',
//   resolveIds,
// }: MorphBoxOpts): string => {
//   // Map all items by id for quick lookup + a set for membership tests
//   const itemById = new Map<ID, ContextualItem>();
//   const itemIdSet = new Set<ID>();
//   for (const sc of components) {
//     for (const it of sc.values || []) {
//       itemById.set(it.id, it);
//       itemIdSet.add(it.id);
//     }
//   }

//   // Default resolver: supports several common narrative shapes and
//   // falls back to a safe deep scan limited to known item IDs.
//   const defaultResolve: ResolveIds = (n, known) => {
//     const out: ID[] = [];

//     const pushVal = (v: unknown) => {
//       if (typeof v === 'string' && known.has(v)) out.push(v as ID);
//       else if (Array.isArray(v)) v.forEach(pushVal);
//     };

//     // Known shapes:
//     // 1) n.components: { [componentId: ID]: ID | ID[] }
//     if (n && typeof n === 'object' && 'components' in n) {
//       const obj = (n as AnyNarrative).components as Record<string, unknown>;
//       if (obj && typeof obj === 'object') Object.values(obj).forEach(pushVal);
//     }

//     // 2) n.selections: { [componentId: ID]: ID | ID[] }
//     if (n && typeof n === 'object' && 'selections' in n) {
//       const obj = (n as AnyNarrative).selections as Record<string, unknown>;
//       if (obj && typeof obj === 'object') Object.values(obj).forEach(pushVal);
//     }

//     // 3) n.items: ID[]
//     if (n && typeof n === 'object' && 'items' in n) {
//       pushVal((n as AnyNarrative).items);
//     }

//     // If nothing found yet, do a bounded deep scan over values and pick strings that are known IDs.
//     if (out.length === 0) {
//       const stack: unknown[] = [n];
//       const seen = new Set<unknown>();
//       while (stack.length) {
//         const cur = stack.pop();
//         if (!cur || seen.has(cur)) continue;
//         seen.add(cur);

//         if (typeof cur === 'string') {
//           if (known.has(cur)) out.push(cur as ID);
//         } else if (Array.isArray(cur)) {
//           for (const v of cur) stack.push(v);
//         } else if (typeof cur === 'object') {
//           for (const v of Object.values(cur as Record<string, unknown>)) {
//             stack.push(v);
//           }
//         }
//       }
//     }
//     return out;
//   };

//   const pickIds = resolveIds ?? defaultResolve;

//   // Count occurrences across all narratives
//   const counts: Record<ID, number> = {};
//   for (const n of narratives || []) {
//     const ids = pickIds(n, itemIdSet);
//     for (const id of ids) {
//       if (!counts[id]) counts[id] = 0;
//       counts[id] += 1; // counts every occurrence; if you want "per narrative at most once", change to a Set per narrative
//     }
//   }

//   // Helpers
//   const colorIcon = (id: ID): string => {
//     const [bg] = compColor[id] || ['#999999', '#ffffff'];
//     if (colorStyle === 'emoji') {
//       // crude mapping by hue; fallback to a square
//       const hex = ('' + bg).replace('#', '').toLowerCase();
//       const emoji = hex.startsWith('ff')
//         ? '🟥'
//         : hex.startsWith('00ff')
//         ? '🟩'
//         : hex.startsWith('0000ff')
//         ? '🟦'
//         : hex.startsWith('ffff00')
//         ? '🟨'
//         : hex.startsWith('ff00')
//         ? '🟪'
//         : '🟩';
//       return emoji;
//     }
//     // tiny color square via placeholder image (renders in most Markdown engines)
//     const hex = ('' + bg).replace('#', '');
//     return `![#${hex}](https://via.placeholder.com/12/${hex}/000000?text=+)`;
//   };

//   // Build columns: one string per ContextualItem in original order
//   const headers = components.map((sc) => sc.label);
//   const columns: string[][] = components.map((sc) => {
//     const col: string[] = [];
//     for (const it of sc.values || []) {
//       const cnt = counts[it.id] ?? 0;
//       const label = capitalize(it.label);
//       const desc = includeDescriptions && it.desc ? ` — ${it.desc}` : '';
//       col.push(`${colorIcon(it.id)} ${label} (${cnt}x)${desc}`);
//     }
//     return col;
//   });

//   // Normalize row count to the tallest column
//   const maxRows = Math.max(0, ...columns.map((c) => c.length));
//   const headerRow = `| ${headers.join(' | ')} |`;
//   const sepRow = `| ${headers.map(() => '---').join(' | ')} |`;

//   const bodyRows: string[] = [];
//   for (let r = 0; r < maxRows; r++) {
//     const row = columns.map((col) => col[r] ?? '');
//     bodyRows.push(`| ${row.join(' | ')} |`);
//   }

//   return [headerRow, sepRow, ...bodyRows].join('\n');
// };

// import { ScenarioComponent, ContextualItem, ID, Color } from '../models';
// import { capitalize } from '../utils';

type AnyNarrative = Record<string, unknown>;
type ResolveIds = (n: AnyNarrative, itemIdSet: Set<ID>) => ID[];

interface MorphBoxOpts {
  components: ScenarioComponent[];
  narratives: AnyNarrative[];
  compColor: Record<ID, [Color, Color]>;
  includeDescriptions?: boolean; // default: false
  resolveIds?: ResolveIds; // optional custom resolver
}

/**
 * Generate a Markdown "morphological box" with counts per ContextualItem,
 * using scenario.narratives to determine usage frequency.
 * Each item is shown with a colored square (HTML span).
 */
export const generateMorphologicalBoxMarkdown = ({
  components,
  narratives,
  compColor,
  includeDescriptions = false,
  resolveIds,
}: MorphBoxOpts): string => {
  const itemById = new Map<ID, ContextualItem>();
  const itemIdSet = new Set<ID>();
  for (const sc of components) {
    for (const it of sc.values || []) {
      itemById.set(it.id, it);
      itemIdSet.add(it.id);
    }
  }

  const defaultResolve: ResolveIds = (n, known) => {
    const out: ID[] = [];
    const pushVal = (v: unknown) => {
      if (typeof v === 'string' && known.has(v)) out.push(v as ID);
      else if (Array.isArray(v)) v.forEach(pushVal);
    };
    if (n && typeof n === 'object') {
      if ('components' in n) {
        Object.values((n as any).components || {}).forEach(pushVal);
      }
      if ('selections' in n) {
        Object.values((n as any).selections || {}).forEach(pushVal);
      }
      if ('items' in n) {
        pushVal((n as any).items);
      }
    }
    return out;
  };

  const pickIds = resolveIds ?? defaultResolve;

  const counts: Record<ID, number> = {};
  for (const n of narratives || []) {
    const ids = pickIds(n, itemIdSet);
    for (const id of ids) {
      counts[id] = (counts[id] || 0) + 1;
    }
  }

  const colorSquare = (id: ID): string => {
    const [bg] = compColor[id] || ['#999999', '#ffffff'];
    return `<span style="color:${bg}">■</span>`;
  };

  const headers = components.map((sc) => sc.label);
  const columns: string[][] = components.map((sc) => {
    const col: string[] = [];
    for (const it of sc.values || []) {
      const cnt = counts[it.id] ?? 0;
      const label = capitalize(it.label);
      const desc = includeDescriptions && it.desc ? ` — ${it.desc}` : '';
      col.push(`${colorSquare(it.id)} ${label} (${cnt}x)${desc}`);
    }
    return col;
  });

  const maxRows = Math.max(0, ...columns.map((c) => c.length));
  const headerRow = `| ${headers.join(' | ')} |`;
  const sepRow = `| ${headers.map(() => '---').join(' | ')} |`;

  const bodyRows: string[] = [];
  for (let r = 0; r < maxRows; r++) {
    const row = columns.map((col) => col[r] ?? '');
    bodyRows.push(`| ${row.join(' | ')} |`);
  }

  return [headerRow, sepRow, ...bodyRows].join('\n');
};
