import m, { FactoryComponent } from 'mithril';
import { TextArea } from 'mithril-materialized';
import { t } from '../../services';
import { markdown2html } from '../../utils';

export interface MarkdownFieldAttrs {
  /** Identifies the edited item, so switching items resets the edit mode */
  id: string;
  label: string;
  value?: string;
  oninput: (value: string) => void;
  className?: string;
}

/** Shows text as rendered Markdown, with an edit toggle to change the source. */
export const MarkdownField: FactoryComponent<MarkdownFieldAttrs> = () => {
  let editing = false;
  let currentId: string | undefined;

  return {
    view: ({ attrs: { id, label, value = '', oninput, className = '' } }) => {
      if (id !== currentId) {
        currentId = id;
        editing = false;
      }
      const showEditor = editing || !value.trim();
      return m(`.markdown-field${className ? `.${className}` : ''}`, [
        value.trim() &&
          m(
            'i.material-icons.clickable.right.markdown-field-toggle',
            {
              title: t(editing ? 'SAVE' : 'EDIT'),
              'aria-label': t(editing ? 'SAVE' : 'EDIT'),
              role: 'button',
              tabindex: 0,
              onclick: () => (editing = !editing),
              onkeydown: (e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  editing = !editing;
                }
              },
            },
            editing ? 'check' : 'edit',
          ),
        showEditor
          ? m(TextArea, {
              className: '',
              label,
              value,
              oninput: (v: string) => {
                editing = true;
                oninput(v);
              },
            })
          : [
              m('label.markdown-field-label', label),
              m('.markdown-field-content', markdown2html(value)),
            ],
      ]);
    },
  };
};
