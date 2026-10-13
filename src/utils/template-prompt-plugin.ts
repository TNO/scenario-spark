import m from 'mithril';
import { IconButton, TextArea, toast } from 'mithril-materialized';
import { PluginType, registerPlugin } from 'mithril-ui-form';
import { createTemplatePrompt } from 'morphological-box';
import { Category, ScenarioComponent } from '../models';
import { t } from '../services';

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
        title: t('TEMPLATE_PROMPT_COPY'),
        onclick: () => {
          const prompt = createTemplatePrompt(
            { id: '', label: '', categories, components, inconsistencies: {} },
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
