import m from 'mithril';
import { Icon, ThemeToggle } from 'mithril-materialized';
import logo_white from '../assets/tno_white.svg';
import { IDashboard } from '../models';
import { routingSvc } from '../services/routing-service';
import { MeiosisComponent, changePage, i18n, setLanguage } from '../services';
// import { LANGUAGE } from '../utils';
import DutchFlag from '../assets/flag-nl.png';
import EnglishFlag from '../assets/flag-en.png';

// export const setLanguage = async (locale = i18n.currentLocale) => {
//   localStorage.setItem(LANGUAGE, locale);
//   await i18n.loadAndSetLocale(locale);
// };

export const Layout: MeiosisComponent = () => ({
  view: ({ children, attrs }) => {
    const isActive = (d: IDashboard) =>
      attrs.state.page === d.id ? '.active' : '';

    const routes = routingSvc
      .getList()
      // .filter((d) => curUser === 'admin' || d.id !== Dashboards.SETTINGS)
      .filter(
        (d) =>
          (typeof d.visible === 'boolean'
            ? d.visible
            : d.visible(attrs.state?.model?.scenario)) || isActive(d)
      );

    const language = i18n.currentLocale;

    return m('.main', { style: 'overflow-x: hidden' }, [
      m(
        '.navbar-fixed',
        // { style: 'z-index: 1001' },
        m(
          'nav',
          m('.nav-wrapper', [
            m(
              'a.brand-logo[href=#].show-on-large',
              { style: 'margin-left: 20px' },
              [
                m(`img[width=140][height=60][src=${logo_white}][alt=TNO]`, {
                  style: 'margin-left: -5px;',
                }),
                m(
                  '.title.show-on-med-and-up.truncate',
                  attrs.state.model?.scenario?.label
                ),
              ]
            ),
            m(
              // 'a.sidenav-trigger[href=#!/home][data-target=slide-out]',
              // { onclick: (e: UIEvent) => e.preventDefault() },
              m.route.Link,
              {
                className: 'sidenav-trigger',
                'data-target': 'slide-out',
                href: m.route.get(),
              },
              m(Icon, {
                iconName: 'menu',
                className: 'hide-on-large-and-up black-text',
                style: 'margin-left: 5px;',
              })
            ),
            m('ul#dropdown_languages.dropdown-content', [
              m(
                'li',
                m('a', { href: '#!', onclick: () => setLanguage('nl') }, [
                  m('img', {
                    src: DutchFlag,
                    alt: 'Nederlands',
                    title: 'Nederlands',
                    disabled: language === 'nl',
                    class: language === 'nl' ? 'disabled-image' : 'clickable',
                  }),
                  'Nederlands',
                ])
              ),
              m(
                'li',
                m('a', { href: '#!', onclick: () => setLanguage('en') }, [
                  m('img', {
                    src: EnglishFlag,
                    alt: 'English',
                    title: 'English',
                    disabled: language === 'en',
                    class: language === 'en' ? 'disabled-image' : 'clickable',
                  }),
                  'English',
                ])
              ),
            ]),
            m(
              'ul#slide-out.sidenav.hide-on-large-and-up',
              ...routes.map((d) =>
                m(`li.tooltip${isActive(d)}.unselectable`, [
                  m(
                    'a',
                    { href: routingSvc.href(d.id) },
                    m(Icon, {
                      className: d.iconClass ? ` ${d.iconClass}` : '',
                      iconName: typeof d.icon === 'string' ? d.icon : d.icon(),
                    }),
                    (typeof d.title === 'string'
                      ? d.title
                      : d.title()
                    ).toUpperCase()
                  ),
                ])
              ),
              m('li', m(ThemeToggle))
            ),
            m(
              'ul.right.hide-on-med-and-down',
              ...routes.map((d) =>
                m(`li.tooltip${isActive(d)}.unselectable`, [
                  m(Icon, {
                    className:
                      'hoverable' + (d.iconClass ? ` ${d.iconClass}` : ''),
                    style: 'font-size: 2.2rem; width: 4rem;',
                    iconName: typeof d.icon === 'string' ? d.icon : d.icon(),
                    onclick: () => changePage(attrs, d.id),
                  }),
                  m(
                    'span.tooltiptext',
                    (typeof d.title === 'string'
                      ? d.title
                      : d.title()
                    ).toUpperCase()
                  ),
                ])
              ),
              m('li', m(ThemeToggle))
            ),
          ])
        )
      ),
      m('.container', children),
    ]);
  },
});
