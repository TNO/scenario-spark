import m from 'mithril';
import {
  ModalPanel,
  TextArea,
  TextInput,
  Wizard,
  WizardStep,
  RadioButtons,
  Button,
  uniqueId,
} from 'mithril-materialized';
import { MeiosisComponent, t } from '../services';
import {
  Category,
  Scenario,
  ScenarioComponent,
  thresholdColors,
} from '../models';
import { markdownToMorphBox } from '../utils/morp-box-to-markdown';
import { fixMorphologicalBoxMarkdown } from '../utils';

// Read the base prompt from prompt-guide.md
const BASE_PROMPT = `You are to create one or more **morphological boxes** to systematically explore possible configurations or scenarios related to a defined goal or domain.

Each morphological box must contain **key drivers or main components** that represent **orthogonal (independent)** concepts.

### Structure and Formatting Rules (strictly required)
- The **entire output must be a single Markdown code block** — but **do not include** language tags like “\`\`\`markdown” or “\`\`\`md”. Use only plain triple backticks (\`\`\`).
- Each morphological box must start with a **level-1 Markdown heading** (\`# Box Name\`).
- Each key driver must be numbered as an **ordered list item** (\`1.\`, \`2.\`, etc.).
- Each key driver must include a **short description** after a colon (\`:\`).
- Each driver’s possible **component values** must be listed as **unordered list items** (\`-\`) beneath it.
- Each component value must also have a **short description** after a colon.
- Do **not** use any additional headings (e.g. \`##\` or \`###\`) inside the morphological box.
- Do **not** include any introductory or concluding text — only the pure markdown content.
- Write all content in **fluent, domain-appropriate Dutch**, as if originally composed in Dutch.

### Output Example (format only)

\`\`\`md
# Name of the Morphological Box

1. Key Driver A: Description of what this factor represents
   - Option 1: Short description of the option
   - Option 2: Short description of the option
   - Option 3: Short description of the option

2. Key Driver B: Description of what this factor represents
   - Option 1: Short description of the option
   - Option 2: Short description of the option
   - Option 3: Short description of the option
\`\`\`

### Required elements
- Include **10 ± 2 key drivers**.
- Each factor and each option must have a short description.
- If relevant, generate **two boxes**: one for scenario definition and one for possible responses or measures.
`;

type UserInputs = {
  purpose: string;
  domain: string;
  outputType: string;
  constraints: string;
  detailDepth: string;
  language: string;
};

type LLMSettings = {
  endpoint: 'clipboard' | 'ollama' | 'openai';
  url: string;
  apiKey: string;
  model: string;
};

type WizardState = {
  currentStep: number;
  userInputs: UserInputs;
  fullPrompt: string;
  llmSettings: LLMSettings;
  generatedMarkdown: string;
  isGenerating: boolean;
};

async function generateWithLLM(
  settings: LLMSettings,
  prompt: string
): Promise<string> {
  const { endpoint, url, apiKey, model } = settings;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  let requestBody: any;
  let apiUrl = url;

  if (endpoint === 'ollama') {
    requestBody = {
      model: model || 'gemma2',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      stream: false,
      options: { temperature: 0.7 },
    };
  } else if (endpoint === 'openai') {
    if (!apiKey) throw new Error('API key required for OpenAI');
    headers['Authorization'] = `Bearer ${apiKey}`;
    apiUrl = apiUrl || 'https://api.openai.com/v1/chat/completions';
    requestBody = {
      model: model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are a helpful AI assistant.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      stream: false,
    };
  }

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Error: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  const data = await response.json();

  if (endpoint === 'ollama') {
    return data?.message?.content || '';
  } else {
    return data.choices?.[0]?.message?.content || '';
  }
}

export const LLMScenarioWizard: MeiosisComponent<{
  isOpen: boolean;
  onClose: () => void;
  onComplete: (scenario: Scenario) => void;
}> = () => {
  let wizardState: WizardState = {
    currentStep: 0,
    userInputs: {
      purpose: '',
      domain: '',
      outputType: '',
      constraints: '',
      detailDepth: '',
      language: 'English',
    },
    fullPrompt: '',
    llmSettings: {
      endpoint: 'clipboard',
      url: 'https://localhost:3000/api/chat',
      apiKey: '',
      model: 'granite4',
    },
    generatedMarkdown: '',
    isGenerating: false,
  };

  const resetWizardState = () => {
    wizardState = {
      currentStep: 0,
      userInputs: {
        purpose: '',
        domain: '',
        outputType: '',
        constraints: '',
        detailDepth: '',
        language: 'English',
      },
      fullPrompt: '',
      llmSettings: {
        endpoint: 'clipboard',
        url: 'https://localhost:3000/api/chat',
        apiKey: '',
        model: 'granite4',
      },
      generatedMarkdown: '',
      isGenerating: false,
    };
  };

  return {
    view: ({ attrs }) => {
      const { isOpen, onClose, onComplete } = attrs;

      if (!isOpen) return null;

      const steps: WizardStep[] = [
        // Step 1: Collect user-specific inputs (always in English)
        {
          title: t('LLM_WIZARD_STEP1_TITLE'),
          subtitle: t('LLM_WIZARD_STEP1_SUBTITLE'),
          icon: 'edit_note',
          vnode: () =>
            m('.row', [
              m(
                'p.col.s12',
                'Fill in the details below in English to customize your morphological box generation. The output language can be specified separately.'
              ),

              m(TextArea, {
                id: 'purpose',
                label: 'Purpose',
                isMandatory: true,
                helperText:
                  'What do you want to explore or design? E.g., "crisis management scenarios for national emergency planning"',
                defaultValue: wizardState.userInputs.purpose,
                rows: 3,
                onchange: (value) => {
                  wizardState.userInputs.purpose = value;
                },
              }),

              m(TextInput, {
                id: 'domain',
                label: 'Domain',
                isMandatory: true,
                helperText:
                  'Specify the field or context, e.g., "disaster response", "cybersecurity", "military operations"',
                defaultValue: wizardState.userInputs.domain,
                onchange: (value) => {
                  wizardState.userInputs.domain = value;
                },
              }),

              m(TextInput, {
                id: 'outputType',
                label: 'Intended Output Type',
                helperText:
                  'One morphological box, multiple boxes, scenario-focused, measure-focused, or both?',
                defaultValue: wizardState.userInputs.outputType,
                onchange: (value) => {
                  wizardState.userInputs.outputType = value;
                },
              }),

              m(TextArea, {
                id: 'constraints',
                label: 'Constraints or Focus Areas',
                helperText:
                  'E.g., "Include socio-political, environmental, and technological factors"',
                defaultValue: wizardState.userInputs.constraints,
                rows: 2,
                onchange: (value) => {
                  wizardState.userInputs.constraints = value;
                },
              }),

              m(TextInput, {
                id: 'detailDepth',
                label: 'Example of Desired Depth or Detail',
                helperText:
                  'E.g., "Include 6-7 detailed options per factor, each with a one-sentence definition"',
                defaultValue: wizardState.userInputs.detailDepth,
                onchange: (value) => {
                  wizardState.userInputs.detailDepth = value;
                },
              }),

              m(TextInput, {
                id: 'language',
                label: 'Output Language',
                isMandatory: true,
                helperText:
                  'The language for the generated morphological box content, e.g., "English", "Dutch", "French"',
                defaultValue: wizardState.userInputs.language,
                onchange: (value) => {
                  wizardState.userInputs.language = value;
                },
              }),
            ]),
          validate: () => {
            return (
              wizardState.userInputs.purpose.trim().length > 0 &&
              wizardState.userInputs.domain.trim().length > 0 &&
              wizardState.userInputs.language.trim().length > 0
            );
          },
        },
        // Step 2: Display and edit combined prompt (always in English)
        {
          title: t('LLM_WIZARD_STEP2_TITLE'),
          subtitle: t('LLM_WIZARD_STEP2_SUBTITLE'),
          icon: 'preview',
          vnode: () => {
            return m('.row', [
              m(
                'p.col.s12',
                'Below is the combined prompt consisting of the generic base prompt (in English) and your specific inputs. You can edit it if needed:'
              ),
              m(TextArea, {
                id: 'full-prompt',
                label: 'Complete Prompt (English)',
                defaultValue: wizardState.fullPrompt,
                rows: 25,
                onchange: (value) => {
                  wizardState.fullPrompt = value;
                },
              }),
            ]);
          },
          validate: () => {
            return wizardState.fullPrompt.trim().length > 0;
          },
        },
        // Step 3: LLM service settings
        {
          title: t('LLM_WIZARD_STEP3_TITLE'),
          subtitle: t('LLM_WIZARD_STEP3_SUBTITLE'),
          icon: 'settings',
          vnode: () =>
            m('.row', [
              m('p.col.s12', t('LLM_WIZARD_STEP3_DESC')),
              m('.col.s12', [
                m(RadioButtons, {
                  label: t('LLM_ENDPOINT'),
                  checkedId: wizardState.llmSettings.endpoint,
                  options: [
                    { id: 'clipboard', label: t('LLM_CLIPBOARD') },
                    { id: 'ollama', label: t('LLM_OLLAMA') },
                    { id: 'openai', label: t('LLM_OPENAI') },
                  ],
                  onchange: (value) => {
                    wizardState.llmSettings.endpoint = value as
                      | 'clipboard'
                      | 'ollama'
                      | 'openai';
                  },
                }),
              ]),
              wizardState.llmSettings.endpoint !== 'clipboard' && [
                m('.col.s12', [
                  m(TextInput, {
                    id: 'llm-url',
                    label: t('URL'),
                    helperText:
                      wizardState.llmSettings.endpoint === 'ollama'
                        ? t('LLM_OLLAMA_URL_HELP')
                        : t('LLM_OPENAI_URL_HELP'),
                    defaultValue: wizardState.llmSettings.url,
                    onchange: (value) => {
                      wizardState.llmSettings.url = value;
                    },
                  }),
                ]),
                m('.col.s12', [
                  m(TextInput, {
                    id: 'llm-model',
                    label: t('MODEL'),
                    helperText:
                      wizardState.llmSettings.endpoint === 'ollama'
                        ? t('LLM_OLLAMA_MODEL_HELP')
                        : t('LLM_OPENAI_MODEL_HELP'),
                    defaultValue: wizardState.llmSettings.model,
                    onchange: (value) => {
                      wizardState.llmSettings.model = value;
                    },
                  }),
                ]),
                wizardState.llmSettings.endpoint === 'openai' &&
                  m('.col.s12', [
                    m(TextInput, {
                      id: 'llm-apikey',
                      label: t('API_KEY'),
                      type: 'password',
                      defaultValue: wizardState.llmSettings.apiKey,
                      onchange: (value) => {
                        wizardState.llmSettings.apiKey = value;
                      },
                    }),
                  ]),
              ],
            ]),
          validate: () => {
            if (wizardState.llmSettings.endpoint === 'clipboard') return true;
            if (wizardState.llmSettings.endpoint === 'openai') {
              return (
                wizardState.llmSettings.url.trim().length > 0 &&
                wizardState.llmSettings.model.trim().length > 0 &&
                wizardState.llmSettings.apiKey.trim().length > 0
              );
            }
            return (
              wizardState.llmSettings.url.trim().length > 0 &&
              wizardState.llmSettings.model.trim().length > 0
            );
          },
        },
        // Step 4: Generate or paste markdown
        {
          title: t('LLM_WIZARD_STEP4_TITLE'),
          subtitle: t('LLM_WIZARD_STEP4_SUBTITLE'),
          icon: 'auto_awesome',
          vnode: () => {
            return m('.row', [
              wizardState.llmSettings.endpoint === 'clipboard'
                ? m('.col.s12', [
                    m('p', t('LLM_WIZARD_STEP4_CLIPBOARD_DESC')),
                    m(Button, {
                      label: t('LLM_COPY_PROMPT'),
                      iconName: 'content_copy',
                      className: 'btn',
                      onclick: () => {
                        navigator.clipboard.writeText(wizardState.fullPrompt);
                        alert(t('LLM_PROMPT_COPIED'));
                      },
                    }),
                    m('p.mt-4', t('LLM_PASTE_OUTPUT')),
                  ])
                : m('.col.s12', [
                    wizardState.isGenerating
                      ? m('.center', [
                          m('.preloader-wrapper.active', [
                            m('.spinner-layer.spinner-blue-only', [
                              m('.circle-clipper.left', m('.circle')),
                              m('.gap-patch', m('.circle')),
                              m('.circle-clipper.right', m('.circle')),
                            ]),
                          ]),
                          m('p', t('LLM_GENERATING')),
                        ])
                      : m(Button, {
                          label: t('LLM_GENERATE'),
                          iconName: 'auto_awesome',
                          className: 'btn',
                          disabled: wizardState.generatedMarkdown.length > 0,
                          onclick: async () => {
                            wizardState.isGenerating = true;
                            try {
                              const markdown = await generateWithLLM(
                                wizardState.llmSettings,
                                wizardState.fullPrompt
                              );
                              wizardState.generatedMarkdown =
                                fixMorphologicalBoxMarkdown(markdown);
                            } catch (error) {
                              alert(`${t('LLM_ERROR')}: ${error}`);
                            } finally {
                              wizardState.isGenerating = false;
                              m.redraw();
                            }
                          },
                        }),
                  ]),
              m('.col.s12.mt-4', [
                m(TextArea, {
                  id: 'generated-markdown',
                  label: t('LLM_GENERATED_MARKDOWN'),
                  value: wizardState.generatedMarkdown,
                  rows: 25,
                  oninput: (value) => {
                    wizardState.generatedMarkdown = value;
                  },
                }),
              ]),
            ]);
          },
          validate: () => {
            return wizardState.generatedMarkdown.trim().length > 0;
          },
        },
      ];

      return m(ModalPanel, {
        id: 'llm-scenario-wizard',
        isOpen,
        onClose: () => {
          resetWizardState();
          onClose();
        },
        title: t('LLM_WIZARD_TITLE'),
        fixedFooter: false,
        description: m(Wizard, {
          steps,
          currentStep: wizardState.currentStep,
          onStepChange: (stepIndex: number) => {
            wizardState.currentStep = stepIndex;
            if (stepIndex === 1) {
              const userSection = `## User-Specific Input:

Purpose: ${wizardState.userInputs.purpose}

Domain: ${wizardState.userInputs.domain}

Intended Output Type: ${
                wizardState.userInputs.outputType ||
                'One or multiple morphological boxes as appropriate'
              }

Constraints or Focus Areas: ${
                wizardState.userInputs.constraints || 'None specified'
              }

Example of Desired Depth or Detail: ${
                wizardState.userInputs.detailDepth ||
                'Include 5-7 detailed options per factor, each with a one-sentence definition.'
              }

All morphological boxes and their descriptions must be written in fluent, domain-appropriate ${
                wizardState.userInputs.language
              }, as if originally composed in ${
                wizardState.userInputs.language
              } (not translated).`;

              wizardState.fullPrompt = `${BASE_PROMPT}\n\n${userSection}`;
            }
          },
          onComplete: () => {
            // Convert markdown to Scenario
            const scenario = convertMarkdownToScenario(
              wizardState.generatedMarkdown
            );
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
      });
    },
  };
};

// Helper function to clean markdown markup from text
const cleanMarkup = (text: string): string => {
  return text.replace(/\*{1,3}|_{1,2}/g, '').trim();
};

// Convert markdown to Scenario model
const convertMarkdownToScenario = (markdown: string): Scenario => {
  let scenarioLabel = 'Generated Scenario';
  let scenarioDesc = '';

  const finalCategories: Category[] = [];
  const finalComponents: ScenarioComponent[] = [];

  // Split by H1 headings to handle multiple categories
  const h1Sections = markdown.split(/^#\s+/m).filter((s) => s.trim());

  if (h1Sections.length > 0) {
    h1Sections.forEach((section, index) => {
      const sectionLines = section.split('\n');
      const firstLine = sectionLines[0];
      const titleMatch = firstLine.match(/^(.+?)(?:\s*:\s*(.+))?$/);

      if (titleMatch) {
        const categoryLabel = cleanMarkup(titleMatch[1]);
        const categoryDesc = titleMatch[2]
          ? cleanMarkup(titleMatch[2])
          : undefined;

        // Parse this section
        const sectionMarkdown = '# ' + section;
        const { keyDrivers } = markdownToMorphBox(sectionMarkdown);

        const categoryComponents: ScenarioComponent[] = keyDrivers.map(
          (driver) => ({
            id: uniqueId(),
            label: cleanMarkup(driver.label),
            desc: driver.desc ? cleanMarkup(driver.desc) : undefined,
            values: driver.values.map((v) => ({
              id: uniqueId(),
              label: cleanMarkup(v.label),
              desc: v.desc ? cleanMarkup(v.desc) : undefined,
            })),
          })
        );

        finalComponents.push(...categoryComponents);

        const category: Category = {
          id: uniqueId(),
          label: categoryLabel,
          desc: categoryDesc,
          componentIds: categoryComponents.map((c) => c.id),
        };

        finalCategories.push(category);

        // First category determines scenario name
        if (index === 0 && categoryLabel) {
          scenarioLabel = categoryLabel;
          scenarioDesc = categoryDesc || '';
        }
      }
    });
  }

  // If no categories were created, try parsing as a single category
  if (finalCategories.length === 0) {
    const { label, desc, keyDrivers } = markdownToMorphBox(markdown);

    const components: ScenarioComponent[] = keyDrivers.map((driver) => ({
      id: uniqueId(),
      label: cleanMarkup(driver.label),
      desc: driver.desc ? cleanMarkup(driver.desc) : undefined,
      values: driver.values.map((v) => ({
        id: uniqueId(),
        label: cleanMarkup(v.label),
        desc: v.desc ? cleanMarkup(v.desc) : undefined,
      })),
    }));

    finalComponents.push(...components);

    const category: Category = {
      id: uniqueId(),
      label: label ? cleanMarkup(label) : 'Default Category',
      desc: desc ? cleanMarkup(desc) : undefined,
      componentIds: components.map((c) => c.id),
    };

    finalCategories.push(category);

    if (label) {
      scenarioLabel = cleanMarkup(label);
      scenarioDesc = desc ? cleanMarkup(desc) : '';
    }
  }

  return {
    id: uniqueId(),
    label: scenarioLabel,
    desc: scenarioDesc,
    hideInconsistentValues: false,
    includeDecisionSupport: false,
    inconsistencies: {},
    categories: finalCategories,
    components: finalComponents,
    narratives: [],
    thresholdColors,
  };
};
