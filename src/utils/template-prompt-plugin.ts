import m from 'mithril';
import { IconButton, TextArea, toast } from 'mithril-materialized';
import { PluginType, registerPlugin } from 'mithril-ui-form';
import { Category, ScenarioComponent } from '../models';
import { t } from '../services';

const languageNames: Record<string, string> = {
  en: 'English',
  nl: 'Dutch',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  pl: 'Polish',
};

const generateTemplatePrompt = (
  categories: Category[],
  components: ScenarioComponent[],
  language: string,
): string => {
  const langName = languageNames[language] ?? 'English';
  const lines: string[] = [
    'Please generate a template string for scenario narratives.',
    `Use {n} placeholders (where n is the number shown next to each key driver below) to reference key driver values.`,
    'Write one paragraph per category. The text should flow naturally and professionally.',
    'Return only the template string, no explanation.',
    `The template should be written in ${langName}.`,
    '',
    'Morphological box structure:',
    '',
  ];

  categories.forEach((cat) => {
    lines.push(`## ${cat.label}`);
    if (cat.desc) lines.push(cat.desc);
    lines.push('');
    (cat.componentIds ?? []).forEach((cid) => {
      const comp = components.find((c) => c.id === cid);
      if (!comp) return;
      const idx = components.findIndex((c) => c.id === cid) + 1;
      lines.push(`${idx}. ${comp.label}${comp.desc ? ': ' + comp.desc : ''}`);
      (comp.values ?? []).forEach((v) => lines.push(`   - ${v.label}`));
    });
    lines.push('');
  });

  return lines.join('\n');
};

const templateWithLLMPlugin: PluginType<
  string,
  {},
  { template?: string }
> = () => ({
  view: ({ attrs: { iv, onchange, props, context } }) => {
    const ctxArray: any[] = Array.isArray(context) ? context : [context];
    const find = <T>(key: string): T | undefined =>
      ctxArray.map((c) => c?.[key]).find((v) => v !== undefined);
    const categories: Category[] = find<Category[]>('categories') ?? [];
    const components: ScenarioComponent[] =
      find<ScenarioComponent[]>('components') ?? [];
    const language: string = find<string>('language') ?? 'en';

    return m('.template-with-llm', [
      m(IconButton, {
        className: 'right',
        iconName: 'psychology',
        title: 'Copy LLM prompt to clipboard',
        onclick: () => {
          const prompt = generateTemplatePrompt(
            categories,
            components,
            language,
          );
          navigator.clipboard.writeText(prompt).then(() => {
            toast({ html: t('TEMPLATE_PROMPT_COPIED') as string });
          });
        },
      }),
      m(TextArea, {
        label: props.label,
        value: iv,
        disabled: !onchange,
        helperText: props.description,
        oninput: (v: string) => onchange?.(v),
      }),
    ]);
  },
});

export const registerTemplatePromptPlugin = () => {
  registerPlugin('template-with-llm', templateWithLLMPlugin);
};
