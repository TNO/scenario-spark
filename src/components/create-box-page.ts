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
  Category,
  OsmTypes,
  contextTypeOptions,
} from '../models';
import {
  MeiosisComponent,
  mutateScenarioComponent,
  setPage,
  i18n,
  t,
  moveScenarioComponent,
  setFontSize,
  setMapHeight,
} from '../services';
import {
  FlatButton,
  IconButton,
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
import { LegendComponent, MapView } from './ui';

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
        // .filter((i) => (i.id === 'context' ? hasContext : true))
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
                'span.card-title.morph-cell',
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
            // bottomSheet: true,
            onToggle: (open) => (editorOpen = open),
            description: m(
              '.row',
              attrs.state.model.scenario.includeMapSupport &&
                m(MapView, {
                  items: [obj],
                  mapConfig: attrs.state.model.scenario.mapConfig,
                  height: '200px',
                  autoFit: true,
                }),
              m(LayoutForm, {
                form: contextAwareForm,
                obj,
                i18n: i18n.i18n,             
              } as FormAttributes<ContextualItem>)
            ),
            // options: { opacity: 0.7 },
            closeOnButtonClick: true,
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
        m('div', [
          m('div.widget-link', 
            m(IconButton, {
              iconName: 'add',
              onclick: () => (addComponent = true),
            })
          ),
          m(ModalPanel, {
            id: sc.id,
            title: t('ADD_COMPONENT'),
            fixedFooter: true,
            isOpen: addComponent,
            onToggle: (open) => (addComponent = open),
            closeOnButtonClick: true,
            description: m(
              '.row',
              m(LayoutForm<ContextualItem>, {
                form,
                obj,
                i18n: i18n.i18n,
              })
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
        ]),
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

  const OsmOptions = OsmTypes.map(({ id, name }) => ({ id, label: name }));
  const mapFormOptions = [
    {
      id: 'context',
      type: 'select',
      label: t('CONTEXT'),
      value: 'none',
      options: contextTypeOptions(t),
    },
    {
      id: 'lat',
      show: ['context=location'],
      type: 'number',
      className: 'col s4',
      label: t('LATITUDE'),
    },
    {
      id: 'lon',
      show: ['context=location'],
      type: 'number',
      className: 'col s4',
      label: t('LONGITUDE'),
    },
    {
      id: 'radii',
      show: ['context=location'],
      type: 'text',
      className: 'col s4',
      label: t('RADII'),
    },
    {
      id: 'locationTypeType',
      show: ['context=locationType'],
      type: 'select',
      label: t('LOCATION_TYPE'),
      className: 'col s6',
      options: [
        { id: 'list', label: t('PICK_FROM_LIST') },
        { id: 'keyValue', label: t('ENTER_KEY_VALUE') },
      ],
    },
    {
      id: 'osmTypeId',
      show: ['context=locationType & locationTypeType=list'],
      type: 'select',
      label: t('NAME'),
      className: 'col s6',
      options: OsmOptions,
    },
    {
      id: 'value',
      show: ['context=locationType & locationTypeType=keyValue'],
      type: 'text',
      className: 'col s3',
      label: t('KEY'),
    },
    {
      id: 'key',
      show: ['context=locationType & locationTypeType=keyValue'],
      type: 'text',
      className: 'col s3',
      label: t('VALUE'),
    },
  ] as UIForm<ContextualItem>

  const form = [
    { id: 'id', type: 'none', autogenerate: 'id' },
    { id: 'label', type: 'textarea', label: t('NAME'), autofocus: true },
    { id: 'desc', type: 'textarea', label: t('DESCRIPTION') },
  ] as UIForm<ContextualItem>;

  let narrativeLength = 0;
  let compColor: { [key: ID]: [Color, Color] } = {};
  let themeThresholdColors: ThresholdColor[] = [];
  let lastTheme: string;

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

  let showMap = true;

  return {
    oninit: ({ attrs }) => {
      setPage(attrs, Dashboards.DEFINE_BOX);
    },
    view: ({ attrs }) => {
      const {
        activeTooltip,
        fontSize,
        model: { scenario },
      } = attrs.state;

      const myForm: UIForm<ContextualItem> = [...form];
      if (scenario.includeMapSupport) {
        myForm.push(...mapFormOptions);
      }

      if (activeTooltip) {
        showTooltip(activeTooltip);
      } else {
        hideTooltip();
      }
      const { categories, thresholdColors = [], narratives = [] } = scenario;
      setThresholdColors(thresholdColors);
      const theme = ThemeManager.getEffectiveTheme();
      if (
        Object.keys(compColor).length === 0 ||
        narrativeLength !== narratives.length ||
        lastTheme !== theme
      ) {
        lastTheme = theme;
        narrativeLength = narratives.length;
        compColor = computeCompColor(narratives, themeThresholdColors);
      }

      const { includeMapSupport, mapConfig, mapUnits, osmAmenities } = scenario;
      const allSelectedItems: ContextualItem[] = [];
      if (includeMapSupport) {
        scenario.components.forEach((comp) => {
          comp.values?.forEach((item) => {
            if (item.context === 'location' || item.context === 'locationType') {
              allSelectedItems.push(item);
            }
          });
        });
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
          m(IconButton, {
            style: {
              marginTop: '20px',
              marginBottom: '-40px',
            },
            className: 'right',
            iconName: 'text_increase',
            onclick: () => {
              setFontSize(attrs, fontSize + 1);
            },
          }),
          m(IconButton, {
            style: {
              marginTop: '20px',
              marginBottom: '-40px',
            },
            className: 'right',
            iconName: 'text_decrease',
            onclick: () => {
              setFontSize(attrs, fontSize - 1);
            },
          }),
          includeMapSupport &&
            m(FlatButton, {
              style: {
                marginTop: '20px',
                marginBottom: '-40px',
              },
              className: 'right',
              label: t('TOGGLE', showMap ? 'HIDE' : 'SHOW'),
              iconName: 'map',
              onclick: () => (showMap = !showMap),
            }),
          m(LegendComponent, { items: themeThresholdColors }),
          includeMapSupport &&
            showMap &&
            m(
              '.row',
              m(
                '.col.s12',
                m(MapView, {
                  items: allSelectedItems,
                  mapConfig,
                  mapUnits,
                  osmAmenities,
                  height: attrs.state.mapHeight || 400,
                  onHeightChange: (h) => setMapHeight(attrs, h),
                  // autoFit: true,
                })
              )
            ),
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
                    form: myForm,
                  }),
                })),
              })
            : categories.length === 1 && categories[0].componentIds
            ? m(BoxView, { ...attrs, compColor, categoryId: 0, form: myForm })
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
  components = [],
  narratives = [],
  compColor = {},
  includeDescriptions = false,
  resolveIds,
}: MorphBoxOpts): string => {
  const itemById = new Map<ID, ContextualItem>();
  const itemIdSet = new Set<ID>();
  const hasNarratives = narratives.length > 0;

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
      const cnt = hasNarratives ? counts[it.id] ?? 0 : 0;
      const label = capitalize(it.label);
      const desc = includeDescriptions && it.desc ? ` — ${it.desc}` : '';
      col.push(
        hasNarratives
          ? `${colorSquare(it.id)} ${label} (${cnt}x)${desc}`
          : `${label}${desc}`
      );
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
