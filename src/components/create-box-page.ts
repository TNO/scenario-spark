import m from 'mithril';
import {
  Dashboards,
  ContextualItem,
  ScenarioComponent,
  ID,
  ContextType,
  Color,
} from '../models';
import {
  MeiosisComponent,
  mutateScenarioComponent,
  setPage,
  i18n,
  t,
  moveScenarioComponent,
} from '../services';
import { FlatButton, ModalPanel, Tabs } from 'mithril-materialized';
import {
  FormAttributes,
  LayoutForm,
  SlimdownView,
  UIForm,
} from 'mithril-ui-form';
import { contrastingColor, generateNumbers, modelToSaveName } from '../utils';
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
          style: `background-color: ${color[0]}; color: ${color[1]}`,
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
          m('.card-content', [
            m(
              'span.card-title',
              {
                onmouseenter: item.desc
                  ? () => {
                      attrs.update({
                        activeTooltip: item.desc,
                      });
                    }
                  : undefined,
                onmouseleave: item.desc
                  ? () => {
                      attrs.update({
                        activeTooltip: undefined,
                      });
                    }
                  : undefined,
              },
              item.label
            ),
            // item.desc && m('span.card-desc', item.desc),
            m(FlatButton, {
              className: 'top-right widget-link',
              iconName: 'edit',
              iconClass: 'no-gutter',
              modalId: `modal_${item.id}`,
            }),
          ]),
          m(ModalPanel, {
            id: `modal_${item.id}`,
            title: t('EDIT_COMPONENT'),
            fixedFooter: true,
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
                    activeTooltip: sc.desc,
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
          iconClass: 'no-gutter',
          modalId: sc.id,
          i18n: i18n.i18n,
        }),
        m(ModalPanel, {
          id: sc.id,
          title: t('ADD_COMPONENT'),
          fixedFooter: true,
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
  let compColor: { [key: ID]: [Color, Color] } = {};

  return {
    oninit: ({ attrs }) => {
      setPage(attrs, Dashboards.DEFINE_BOX);
    },
    view: ({ attrs }) => {
      const {
        activeTooltip,
        model: { scenario },
      } = attrs.state;
      const { categories, thresholdColors = [] } = scenario;

      if (compColor || Object.keys(compColor).length < thresholdColors.length) {
        const { narratives = [] } = scenario;
        const componentUsage = narratives
          .filter((n) => n.included)
          .reduce((acc, cur) => {
            const { components: components } = cur;
            Object.keys(components).forEach((c) => {
              for (const compValue of components[c]) {
                if (acc[compValue]) {
                  acc[compValue]++;
                } else {
                  acc[compValue] = 1;
                }
              }
            });
            return acc;
          }, {} as { [key: ID]: number });
        const count2color: Color[] = generateNumbers(
          0,
          Math.max(...thresholdColors.map((c) => c.threshold))
        ).map((_) => '');
        let i = 0;
        thresholdColors
          .sort((a, b) => (a.threshold > b.threshold ? 1 : -1))
          .forEach((tc) => {
            do {
              count2color[i] = tc.color;
              i++;
            } while (i < tc.threshold);
          });
        compColor = Object.entries(componentUsage).reduce(
          (acc, [id, count]) => {
            const color =
              count < count2color.length
                ? count2color[count]
                : count2color[count2color.length - 1];
            acc[id] = [color, contrastingColor(color)];
            return acc;
          },
          { OTHER: [count2color[0], contrastingColor(count2color[0])] } as {
            [key: ID]: [Color, Color];
          }
        );
      }

      return [
        m('.create-box-page', [
          scenario &&
            scenario.thresholdColors &&
            m(LegendComponent, { items: scenario.thresholdColors }),
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
          activeTooltip &&
            m(
              '.popupContainer',
              m(
                '.popupContent.center',
                m(SlimdownView, { md: activeTooltip, removeParagraphs: true })
              )
            ),
        ]),
      ];
    },
  };
};
