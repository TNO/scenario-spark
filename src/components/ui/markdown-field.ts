import m, { FactoryComponent } from 'mithril';
import { TextArea, ThemeManager } from 'mithril-materialized';
import { MarkdownEditor } from 'mithril-markdown-wysiwyg';
import { render } from 'mithril-ui-form';
import { t } from '../../services';
import { clipboardHtmlToMarkdown, markdown2html } from '../../utils';

export interface MarkdownFieldAttrs {
  /** Identifies the edited item, so switching items closes the editor */
  id: string;
  label: string;
  value?: string;
  oninput: (value: string) => void;
  className?: string;
  /** Edit with the rich-text editor (with toolbar) instead of a plain Markdown text area */
  rich?: boolean;
}

/** Pastes formatted text (e.g. copied from an LLM chat or Word) as Markdown instead of plain text. */
const pasteAsMarkdown = (e: ClipboardEvent) => {
  const target = e.target as HTMLTextAreaElement;
  const markdown = clipboardHtmlToMarkdown(e.clipboardData?.getData('text/html') || '');
  if (!markdown || target?.tagName !== 'TEXTAREA') return;
  e.preventDefault();
  const { selectionStart: start, selectionEnd: end, value } = target;
  target.value = value.slice(0, start) + markdown + value.slice(end);
  target.selectionStart = target.selectionEnd = start + markdown.length;
  // Let the TextArea handle it like typed input, so it updates its height and calls oninput.
  target.dispatchEvent(new Event('input', { bubbles: true }));
};

const focusWhenReady = (dom: Element, attempts = 20) => {
  const editable = dom.querySelector('[contenteditable]') as HTMLElement | null;
  if (editable) editable.focus();
  else if (attempts > 0 && dom.isConnected) setTimeout(() => focusWhenReady(dom, attempts - 1), 50);
};

/**
 * Shows text as a bounded, scrollable Markdown note with an edit/save toggle.
 * - rich: clicking the note opens a rich-text editor, which turns back into the note on save,
 *   on clicking outside, or when focus leaves the field.
 * - plain: an empty field shows a Markdown text area that converts pasted formatted text.
 */
export const MarkdownField: FactoryComponent<MarkdownFieldAttrs> = () => {
  let editing = false;
  let currentId: string | undefined;
  let wrapper: HTMLElement | undefined;

  const close = () => {
    if (!editing) return;
    editing = false;
    document.removeEventListener('pointerdown', onPointerDown, true);
    m.redraw();
  };
  // Toolbar buttons may not take focus (e.g. in Safari), so clicks outside are detected separately.
  const onPointerDown = (e: PointerEvent) => {
    if (wrapper && !wrapper.contains(e.target as Node)) close();
  };
  const onFocusOut = () =>
    setTimeout(() => {
      const active = document.activeElement;
      if (wrapper && active && active !== document.body && !wrapper.contains(active)) close();
    });
  const open = () => {
    editing = true;
    document.addEventListener('pointerdown', onPointerDown, true);
    // The editor renders its editable area in a later redraw, so wait for it before focusing.
    if (wrapper) focusWhenReady(wrapper);
  };
  const toggle = () => (editing ? close() : open());
  const onKey = (action: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  return {
    onremove: () => document.removeEventListener('pointerdown', onPointerDown, true),
    view: ({ attrs: { id, label, value = '', oninput, className = '', rich = false } }) => {
      if (id !== currentId) {
        currentId = id;
        if (editing) {
          editing = false;
          document.removeEventListener('pointerdown', onPointerDown, true);
        }
      }
      const hasText = !!value.trim();
      const action = t(editing ? 'SAVE' : 'EDIT');
      const toggleEdit = rich ? toggle : () => (editing = !editing);
      const body = () => {
        if (rich && editing)
          return m(
            '.markdown-field-editor',
            { onfocusout: onFocusOut },
            m(MarkdownEditor, {
              content: value,
              onContentChange: oninput,
              theme: ThemeManager.getTheme(),
              toolbar: true,
              showTabs: false,
              markdownToHtml: render,
            }),
          );
        if (!rich && (editing || !hasText))
          return m(
            '.markdown-field-textarea',
            m(TextArea, {
              className: '',
              'aria-label': label,
              value,
              onpaste: pasteAsMarkdown,
              oninput: (v: string) => {
                editing = true;
                oninput(v);
              },
            }),
          );
        const content = hasText
          ? m('.markdown-field-content', markdown2html(value))
          : m('.markdown-field-empty', t('MARKDOWN_FIELD_EMPTY'));
        return rich
          ? m(
              '.markdown-field-body.clickable',
              {
                tabindex: 0,
                role: 'button',
                'aria-label': `${action}: ${label}`,
                onclick: (e: MouseEvent) => {
                  if (!(e.target as HTMLElement).closest('a')) open();
                },
                onkeydown: (e: KeyboardEvent) => e.target === e.currentTarget && onKey(open)(e),
              },
              content,
            )
          : m('.markdown-field-body', content);
      };
      return m(
        `.markdown-field.category-card${editing ? '.editing' : ''}${className ? `.${className}` : ''}`,
        rich
          ? {
              oncreate: ({ dom }) => (wrapper = dom as HTMLElement),
              onupdate: ({ dom }) => (wrapper = dom as HTMLElement),
            }
          : {},
        [
          m('.category-card-header.markdown-field-header', [
            m('h5.truncate', label),
            (rich || hasText) &&
              m(
                'i.material-icons.clickable.markdown-field-toggle',
                {
                  title: action,
                  'aria-label': action,
                  role: 'button',
                  tabindex: 0,
                  onclick: toggleEdit,
                  onkeydown: onKey(toggleEdit),
                },
                editing ? 'check' : 'edit',
              ),
          ]),
          body(),
        ],
      );
    },
  };
};
