import m from 'mithril';
import {
  ModalPanel,
  Select,
  Wizard,
  WizardStep,
  uniqueId,
  TextArea,
  Button,
} from 'mithril-materialized';
import { LayoutForm } from 'mithril-ui-form';
import { MeiosisComponent, t } from '../services';
import {
  Category,
  Scenario,
  ScenarioComponent,
  thresholdColors,
} from '../models';
import { csvToMarkdown } from '../utils/csv-to-markdown';
import { markdownToMorphBox } from '../utils/morp-box-to-markdown';

// Simple types for wizard state
type WizardScenario = {
  id: string;
  label: string;
  desc?: string;
};

type WizardCategory = {
  id: string;
  label: string;
  desc?: string;
};

type WizardDriver = {
  id: string;
  label: string;
  desc?: string;
};

type WizardValue = {
  id: string;
  label: string;
  desc?: string;
};

type WizardState = {
  currentStep: number;
  scenario: WizardScenario;
  category: WizardCategory;
  drivers: WizardDriver[];
  selectedDriverIndex?: number;
  driverValues: { [driverIndex: number]: WizardValue[] };
  showImportPanel: boolean;
  importRawText: string;
  importWarnings: string[];
};

export const NewScenarioWizard: MeiosisComponent<{
  isOpen: boolean;
  onClose: () => void;
  onComplete: (scenario: Scenario) => void;
}> = () => {
  let wizardState: WizardState = {
    currentStep: 0,
    scenario: {} as WizardScenario,
    category: {} as WizardCategory,
    drivers: [],
    driverValues: {},
    showImportPanel: false,
    importRawText: '',
    importWarnings: [],
  };

  const resetWizardState = () => {
    wizardState = {
      currentStep: 0,
      scenario: {} as WizardScenario,
      category: {} as WizardCategory,
      drivers: [],
      driverValues: {},
      showImportPanel: false,
      importRawText: '',
      importWarnings: [],
    };
  };

  return {
    view: ({ attrs }) => {
      const { isOpen, onClose, onComplete } = attrs;

      if (!isOpen) return null;

      const steps: WizardStep[] = [
        // Step 1: Scenario Information
        {
          title: t('WIZARD_STEP1_TITLE'),
          subtitle: t('WIZARD_STEP1_SUBTITLE'),
          icon: 'description',
          vnode: () =>
            m('.row', [
              m(LayoutForm, {
                form: [
                  { id: 'id', autogenerate: 'id' },
                  {
                    id: 'label',
                    type: 'text',
                    label: t('NAME'),
                    required: true,
                    className: 'col s12',
                  },
                  {
                    id: 'desc',
                    type: 'textarea',
                    label: t('DESCRIPTION'),
                    className: 'col s12',
                  },
                ],
                obj: wizardState.scenario,
                // onchange: () => m.redraw(),
              }),
            ]),
          validate: () => {
            return (
              typeof wizardState.scenario.label === 'string' &&
              wizardState.scenario.label.trim().length > 0
            );
          },
        },
        // Step 2: Key Drivers
        {
          title: t('WIZARD_STEP2_TITLE'),
          subtitle: t('WIZARD_STEP2_SUBTITLE'),
          icon: 'category',
          vnode: () =>
            m('.row', [
              m('h6.col.s12', t('WIZARD_CATEGORY_INFO')),
              m(LayoutForm, {
                form: [
                  { id: 'id', autogenerate: 'id' },
                  {
                    id: 'label',
                    type: 'text',
                    label: t('NAME'),
                    required: true,
                    className: 'col s12 m6',
                  },
                  {
                    id: 'desc',
                    type: 'text',
                    label: t('DESCRIPTION'),
                    className: 'col s12 m6',
                  },
                ],
                obj: wizardState.category,
                // onchange: () => m.redraw(),
              }),
              m('h6.col.s12', t('WIZARD_COMPONENTS_INFO')),
              m(LayoutForm, {
                form: [
                  {
                    id: 'drivers',
                    type: [
                      { id: 'id', autogenerate: 'id' },
                      {
                        id: 'label',
                        type: 'text',
                        className: 'col s6',
                        label: t('NAME'),
                        required: true,
                      },
                      {
                        id: 'desc',
                        type: 'text',
                        className: 'col s6',
                        label: t('DESCRIPTION'),
                      },
                    ],
                    repeat: true,
                    pageSize: 0,
                    label: t('DIMENSIONS'),
                  },
                ],
                obj: { drivers: wizardState.drivers },
                onchange: () => m.redraw(),
              }),
              m('.col.s12', [
                m(Button, {
                  className: 'btn-flat',
                  label: t('IMPORT_FROM_SPREADSHEET'),
                  iconName: 'upload_file',
                  onclick: () => {
                    wizardState.showImportPanel = true;
                    wizardState.importRawText = '';
                    m.redraw();
                  },
                }),
              ]),
              wizardState.showImportPanel &&
                m(ModalPanel, {
                  id: 'spreadsheet-import',
                  isOpen: wizardState.showImportPanel,
                  onToggle: (open) => {
                    if (!open) {
                      wizardState.showImportPanel = false;
                      wizardState.importWarnings = [];
                      m.redraw();
                    }
                  },
                  title: t('IMPORT_FROM_SPREADSHEET'),
                  description: m('.row', [
                    m(TextArea, {
                      id: 'import-spreadsheet',
                      label: t('IMPORT_PASTE_DATA'),
                      placeholder: t('IMPORT_PLACEHOLDER'),
                      value: wizardState.importRawText,
                      rows: 10,
                      oninput: (value) => {
                        wizardState.importRawText = value;
                        m.redraw();
                      },
                    }),
                    wizardState.importRawText.trim().length > 0 && [
                      m('.col.s12', [
                        m(Button, {
                          className: 'btn',
                          label: t('IMPORT_PARSE'),
                          iconName: 'play_arrow',
                          onclick: () => {
                            const { markdown, warnings } =
                              csvToMarkdown(
                                wizardState.importRawText,
                                wizardState.category.label
                              );
                            if (warnings.includes('IMPORT_NO_DRIVERS')) {
                              alert(t('IMPORT_NO_DRIVERS'));
                              return;
                            }
                            if (
                              warnings.includes('IMPORT_NEEDS_TWO_COLUMNS')
                            ) {
                              alert(t('IMPORT_NEEDS_TWO_COLUMNS'));
                              return;
                            }
                            wizardState.importWarnings = warnings;
                            // Parse markdown back to KeyDriver format
                            const { keyDrivers } =
                              markdownToMorphBox(markdown);
                            // Fill in the drivers array
                            wizardState.drivers = keyDrivers.map((d) => ({
                              id: uniqueId(),
                              label: d.label,
                              desc: d.desc,
                            }));
                            // Fill in values for each driver
                            wizardState.driverValues = {};
                            keyDrivers.forEach((d, idx) => {
                              wizardState.driverValues[idx] = d.values.map(
                                (v) => ({
                                  id: uniqueId(),
                                  label: v.label,
                                  desc: v.desc,
                                })
                              );
                            });
                            wizardState.showImportPanel = false;
                            wizardState.importRawText = '';
                            wizardState.importWarnings = [];
                            m.redraw();
                          },
                        }),
                      ]),
                      wizardState.importWarnings.length > 0 &&
                        wizardState.importWarnings.map(
                          (w) =>
                            w !== 'IMPORT_NO_DRIVERS' &&
                            w !== 'IMPORT_NEEDS_TWO_COLUMNS' &&
                            m('.col.s12.red-text', t(w))
                        ),
                    ],
                  ]),
                  fixedFooter: false,
                }),
            ]),
          validate: () => {
            return (
              typeof wizardState.category.label === 'string' &&
              wizardState.category.label.trim().length > 0 &&
              wizardState.drivers.length > 0 &&
              wizardState.drivers.every(
                (c) => typeof c.label === 'string' && c.label.trim().length > 0
              )
            );
          },
        },
        // Step 3: Driver Options (Optional)
        {
          title: t('WIZARD_STEP3_TITLE'),
          subtitle: t('WIZARD_STEP3_SUBTITLE'),
          icon: 'tune',
          optional: true,
          vnode: () =>
            m('.row', [
              m('p.col.s12', t('WIZARD_VALUES_INFO')),
              wizardState.drivers.length === 0
                ? m('p.grey-text', t('WIZARD_NO_COMPONENTS'))
                : m(Select<number>, {
                    label: t('DIMENSION_SELECTED'),
                    options: wizardState.drivers.map((c, idx) => ({
                      id: idx,
                      label: c.label || `Component ${idx + 1}`,
                    })),
                    onchange: (i) => {
                      wizardState.selectedDriverIndex = i[0];
                    },
                  }),
              wizardState.selectedDriverIndex !== undefined &&
                wizardState.drivers[wizardState.selectedDriverIndex] &&
                m(LayoutForm<{ values: WizardValue[] }>, {
                  form: [
                    {
                      id: 'values',
                      type: [
                        { id: 'id', autogenerate: 'id' },
                        {
                          id: 'label',
                          type: 'text',
                          className: 'col s6',
                          label: t('NAME'),
                          required: true,
                        },
                        {
                          id: 'desc',
                          type: 'text',
                          className: 'col s6',
                          label: t('DESCRIPTION'),
                        },
                      ],
                      repeat: true,
                      pageSize: 0,
                      label: t('WIZARD_VALUES_FOR_COMPONENT', {
                        component:
                          wizardState.drivers[wizardState.selectedDriverIndex]
                            .label,
                      }),
                    },
                  ],
                  obj: {
                    values:
                      wizardState.driverValues[
                        wizardState.selectedDriverIndex
                      ] || ([] as WizardValue[]),
                  },
                  onchange: (_isValid, obj) => {
                    if (obj) {
                      wizardState.driverValues[
                        wizardState.selectedDriverIndex || 0
                      ] = obj.values;
                    }
                  },
                }),
            ]),
        },
      ];

      return m(ModalPanel, {
        id: 'new-scenario-wizard',
        isOpen,
        onToggle: (open) => {
          if (!open) onClose();
        },
        title: t('NEW_SCENARIO'),
        fixedFooter: false,
        description: m(Wizard, {
          steps,
          currentStep: wizardState.currentStep,
          onStepChange: (stepIndex: number) => {
            wizardState.currentStep = stepIndex;
          },
          onComplete: () => {
            // Build the complete scenario from wizard state
            const categoryId = uniqueId();

            // Create components with their values
            const components: ScenarioComponent[] = wizardState.drivers.map(
              (driver, idx) => {
                const componentId = uniqueId();
                const values = (wizardState.driverValues[idx] || []).map(
                  (v) => ({
                    id: uniqueId(),
                    label: v.label,
                    desc: v.desc,
                  })
                );

                return {
                  id: componentId,
                  label: driver.label,
                  desc: driver.desc,
                  values,
                };
              }
            );

            const componentIds = components.map((c) => c.id);

            const category: Category = {
              id: categoryId,
              label: wizardState.category.label,
              desc: wizardState.category.desc,
              componentIds,
            };

            const scenario: Scenario = {
              id: uniqueId(),
              label: wizardState.scenario.label,
              desc: wizardState.scenario.desc,
              hideInconsistentValues: false,
              includeDecisionSupport: false,
              inconsistencies: {},
              categories: [category],
              components,
              narratives: [],
              thresholdColors,
            };

            resetWizardState();
            onComplete(scenario);
          },
          showStepNumbers: true,
          linear: true,
          orientation: 'horizontal',
          allowHeaderNavigation: false,
          labels: {
            next: t('WIZARD_NEXT'),
            previous: t('WIZARD_PREVIOUS'),
            complete: t('WIZARD_COMPLETE'),
            skip: t('WIZARD_SKIP'),
          },
        }),
        // buttons: [
        //   {
        //     label: t('CANCEL'),
        //     iconName: 'cancel',
        //     onclick: () => {
        //       resetWizardState();
        //       onClose();
        //     },
        //   },
        // ],
      });
    },
  };
};
