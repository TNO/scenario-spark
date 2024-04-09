import m, { FactoryComponent } from 'mithril';
import Quill from 'quill';
import {
  FlatButton,
  ISelectOptions,
  Icon,
  InputCheckbox,
  ModalPanel,
  Select,
  TextInput,
  uniqueId,
} from 'mithril-materialized';
import { Dashboards, ID, Narrative } from '../models';
import { MeiosisComponent, saveModel, setPage, t } from '../services';
import { deepCopy, generateNarrative, narrativesToOptions } from '../utils';

const ToggleIcon: FactoryComponent<{
  on: string;
  off: string;
  value: boolean;
  disabled?: boolean;
  callback: (newValue: boolean) => void;
}> = () => {
  return {
    view: ({ attrs: { on, off, value, disabled, callback } }) => {
      const iconName = value ? on : off;
      return m(Icon, {
        className: `clickable${disabled ? ' grey-text' : ''}`,
        iconName,
        disabled,
        onclick: disabled ? {} : () => callback(!value),
      });
    },
  };
};

export const CategoryTable: MeiosisComponent<{
  catId: ID;
  excluded: Set<string>;
}> = () => {
  let lockState = false;

  return {
    view: ({ attrs }) => {
      const {
        catId,
        excluded,
        state: {
          model,
          excludedComps = {},
          lockedComps = {},
          curNarrative = {} as Narrative,
        },
      } = attrs;
      const {
        scenario: { categories = [], components: modelComps = [] },
      } = model;
      const multipleCategories = categories.length > 1;
      const category = categories.filter((c) => c.id === catId).shift();
      const componentIds = category && category.componentIds;
      const comps =
        componentIds &&
        modelComps.filter((c) => componentIds.indexOf(c.id) >= 0);

      const { components = {} } = curNarrative;

      return (
        category &&
        comps &&
        m('.scenario-table.row', [
          m('.col.s11', multipleCategories && m('h5', category.label)),
          m('.col.s1.icons', [
            // m(ToggleIcon, {
            //   on: 'visibility',
            //   off: 'visibility_off',
            //   value: true,
            //   callback: () => {
            //     attrs.update({
            //       excludedComps: (e = {}) => {
            //         category?.componentIds.forEach((id) => delete e[id]);
            //         return e;
            //       },
            //     });
            //   },
            // }),
            m(ToggleIcon, {
              on: 'lock_open',
              off: 'lock',
              value: lockState,
              callback: (v) => {
                lockState = v;
                attrs.update({
                  lockedComps: (l = {}) => {
                    category?.componentIds?.forEach(
                      (id) => (l[id] = lockState)
                    );
                    return l;
                  },
                });
              },
            }),
          ]),
          comps.map((c) => [
            [
              m(Select, {
                label: c.label,
                key: `key_${c.id}_${excludedComps[c.id]}`,
                className: 'col s11',
                multiple: true,
                disabled:
                  typeof excludedComps[c.id] !== 'undefined' &&
                  excludedComps[c.id],
                initialValue: components[c.id],
                options: c.values?.filter((c) => !excluded.has(c.id)),
                placeholder: t('i18n', 'pick'),
                onchange: (ids) => {
                  if (!curNarrative.components) {
                    curNarrative.components = {};
                  }
                  curNarrative.components[c.id] = ids;
                  attrs.update({ curNarrative });
                },
              } as ISelectOptions<string>),
            ],
            m('.col.s1.icons', [
              // m(ToggleIcon, {
              //   on: 'visibility',
              //   off: 'visibility_off',
              //   disabled: c.manual,
              //   value: excludedComps[c.id] ? false : true,
              //   callback: (v) => {
              //     attrs.update({
              //       excludedComps: (e = {}) => {
              //         e[c.id] = !v;
              //         return e;
              //       },
              //     });
              //   },
              // }),
              m(ToggleIcon, {
                on: 'lock_open',
                off: 'lock',
                disabled: c.manual,
                value: c.manual || lockedComps[c.id] ? false : true,
                callback: (v) => {
                  attrs.update({
                    lockedComps: (e = {}) => {
                      e[c.id] = !v;
                      return e;
                    },
                  });
                },
              }),
            ]),
          ]),
        ])
      );
    },
  };
};

export const CreateScenarioPage: MeiosisComponent = () => {
  let editor: Quill;
  let version = 0;

  return {
    oninit: ({ attrs }) => setPage(attrs, Dashboards.CREATE_SCENARIO),
    view: ({ attrs }) => {
      const {
        state: { model, curNarrative = {} as Narrative, lockedComps = {} },
      } = attrs;
      const {
        categories = [],
        inconsistencies = {},
        hideInconsistentValues = false,
      } = model.scenario;
      const narratives = model.scenario && model.scenario.narratives;
      const excluded =
        curNarrative.components && hideInconsistentValues
          ? Object.keys(curNarrative.components).reduce((acc, cur) => {
              curNarrative.components[cur].forEach(
                (v) =>
                  inconsistencies[v] &&
                  Object.keys(inconsistencies[v]).forEach(
                    (id) => inconsistencies[v][id] && acc.add(id)
                  )
              );
              return acc;
            }, new Set<string>())
          : new Set<string>();
      const selectOptions = narrativesToOptions(model.scenario.narratives);

      return m('.create-scenario.row', [
        m('.col.s12', [
          m(FlatButton, {
            label: t('GENERATE_NARRATIVE'),
            iconName: 'refresh',
            onclick: () => {
              const { components = {} } = curNarrative;
              const locked = components
                ? Object.keys(lockedComps).reduce((acc, cur) => {
                    if (lockedComps[cur]) {
                      acc[cur] = components[cur];
                    }
                    return acc;
                  }, {} as Record<ID, ID[]>)
                : ({} as Record<ID, ID[]>);
              model.scenario.components
                .filter((c) => c.manual)
                .forEach((c) => {
                  locked[c.id] = components[c.id];
                });
              const narrative = generateNarrative(model.scenario, locked);
              if (!narrative) {
                alert(t('NO_NARRATIVE'));
              } else {
                version++;
                attrs.update({ curNarrative: () => narrative });
              }
            },
          }),
          m(FlatButton, {
            label: t('CLEAR_NARRATIVE'),
            iconName: 'clear',
            style: 'margin-left: 10px;',
            onclick: () => {
              version = version === 0 ? 1 : 0;
              editor.setContents([] as any);
              attrs.update({
                lockedComps: () => ({}),
                curNarrative: () =>
                  ({ included: false, components: {} } as Narrative),
              });
            },
          }),
          m(FlatButton, {
            label: t('SAVE_NARRATIVE'),
            iconName: 'save',
            disabled:
              !curNarrative.label ||
              !curNarrative.components ||
              Object.keys(curNarrative.components).length === 0,
            onclick: () => {
              if (!curNarrative.id) curNarrative.id = uniqueId();
              if (!model.scenario.narratives) {
                curNarrative.saved = true;
                model.scenario.narratives = [curNarrative];
              } else {
                if (curNarrative.saved) {
                  model.scenario.narratives = model.scenario.narratives.map(
                    (n) => (n.id !== curNarrative.id ? n : curNarrative)
                  );
                } else {
                  curNarrative.saved = true;
                  model.scenario.narratives.push(curNarrative);
                }
              }
              saveModel(attrs, model);
            },
          }),
          curNarrative.saved && [
            m(FlatButton, {
              label: t('DELETE'),
              iconName: 'delete',
              modalId: 'deleteSavedNarrative',
            }),
            m(ModalPanel, {
              id: 'deleteSavedNarrative',
              title: t('DELETE_ITEM', 'title', { item: t('NARRATIVE') }),
              description: t('DELETE_ITEM', 'description', {
                item: t('NARRATIVE'),
              }),
              buttons: [
                {
                  label: t('CANCEL'),
                },
                {
                  label: t('OK'),
                  onclick: () => {
                    version = 0;
                    model.scenario.narratives =
                      model.scenario.narratives.filter(
                        (n) => n.id !== curNarrative.id
                      );
                    attrs.update({
                      curNarrative: () =>
                        ({ included: false, components: {} } as Narrative),
                    });
                    saveModel(attrs, model);
                  },
                },
              ],
            }),
          ],
          narratives &&
            m(Select, {
              className: 'right mb0 w30',
              label: t('SELECT_NARRATIVE'),
              checkedId: curNarrative.saved ? curNarrative.id : undefined,
              placeholder: t('i18n', 'pickOne'),
              options: selectOptions,
              onchange: (v) => {
                if (v && v.length > 0) {
                  version++;
                  const newNarrative = narratives
                    .filter((n) => n.id === v[0])
                    .shift();
                  if (newNarrative) {
                    editor.setContents(
                      newNarrative.desc ? JSON.parse(newNarrative.desc) : []
                    );
                  }
                  // if (newNarrative) newNarrative.included = true;
                  attrs.update({
                    curNarrative: () => deepCopy(newNarrative),
                    lockedComps: () =>
                      model.scenario.components.reduce((acc, cur) => {
                        acc[cur.id] = true;
                        return acc;
                      }, {} as Record<ID, boolean>),
                  });
                }
              },
            } as ISelectOptions<string>),
        ]),
        [
          categories.map((c, i) =>
            m(
              '.col.s12',
              {
                className: `m${Math.round(12 / categories.length)}`,
                key: 10000 * version + i,
              },
              m(CategoryTable, {
                ...attrs,
                catId: c.id,
                excluded,
              })
            )
          ),
        ],
        m(
          '.col.s12',
          {
            oncreate: () => {
              editor = new Quill('#editor', {
                // debug: 'info',
                modules: {
                  // table: true,
                  toolbar: [
                    [{ header: [1, 2, false] }],
                    ['bold', 'italic', 'underline', 'strike'],
                    [{ list: 'ordered' }, { list: 'bullet' }],
                    [{ script: 'sub' }, { script: 'super' }], // superscript/subscript
                    [{ indent: '-1' }, { indent: '+1' }], // outdent/indent
                    [
                      { color: [] },
                      // , { background: [] }
                    ], // dropdown with defaults from theme
                    // [{ font: [] }],
                    [{ align: [] }],
                    ['image', 'code-block'],
                  ],
                },
                placeholder: t('EDITOR_PLACEHOLDER'),
                readOnly: false,
                theme: 'snow',
              });
              editor.on('text-change', () => {
                curNarrative.desc = JSON.stringify(editor.getContents());
                attrs.update({ curNarrative });
              });
              if (curNarrative) {
                editor.setContents(
                  curNarrative.desc ? JSON.parse(curNarrative.desc) : []
                );
              }
            },
          },
          [
            m('.row', [
              m(TextInput, {
                className: 'col s4',
                initialValue: curNarrative.label,
                label: t('NAME_NARRATIVE'),
                required: true,
                onchange: (n) => {
                  curNarrative.label = n;
                  attrs.update({ curNarrative });
                },
              }),
              m(InputCheckbox, {
                className: 'col s4 mt25',
                checked: curNarrative.included,
                label: t('INCLUDE_NARRATIVE'),
                onchange: (n) => {
                  curNarrative.included = n;
                  attrs.update({ curNarrative });
                },
              }),
              m('.col.s4', []),
            ]),
            // m('#toolbar'),
            m('#editor', {}),
          ]
        ),
      ]);
    },
  };
};
