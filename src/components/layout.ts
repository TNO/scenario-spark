import m from 'mithril';
import { Icon, Menu, ThemeToggle } from 'mithril-materialized';
import logo_white from '../assets/tno_white.svg';
import { IDashboard } from '../models';
import { routingSvc } from '../services/routing-service';
import { MeiosisComponent, changePage, i18n, setLanguage, t } from '../services';
// import { LANGUAGE } from '../utils';
import type { Languages } from '../services/translations';
import { CircularSpinner } from './ui/preloader';

const DesktopLanguageMenu = Menu<Languages>();
const MobileLanguageMenu = Menu<Languages>();
const languages: Languages[] = ['nl', 'en', 'fr', 'de', 'es', 'pl'];

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
            : d.visible(attrs.state?.model?.scenario)) || isActive(d),
      );

    const language = i18n.currentLocale;
    const navUtilities = (mobile = false) => [
      m('li', m(mobile ? MobileLanguageMenu : DesktopLanguageMenu, {
        ariaLabel: t('SET_LANGUAGE'),
        menuClassName: 'language-menu',
        trigger: (menuAttrs) => m('button.nav-language-button', {
          ...menuAttrs,
          type: 'button',
          title: t('SET_LANGUAGE'),
          'aria-label': t('SET_LANGUAGE'),
        }, m(Icon, { iconName: 'language' })),
        items: languages.map((locale) => ({
          id: locale,
          label: t('LANGUAGE_NAMES', locale),
          iconName: locale === language ? 'check' : undefined,
          className: `nav-language-item nav-language-item-${locale}`,
        })),
        onSelect: (locale) => {
          if (locale !== language) setLanguage(attrs, locale);
        },
      })),
      m('li', m(ThemeToggle)),
    ];

    return m('.main', { style: 'overflow-x: hidden' }, [
      m(
        '.navbar-fixed',
        // { style: 'z-index: 1001' },
        m(
          'nav',
          m('.nav-wrapper', [
            m(
              'a.brand-logo[href=#].show-on-large',
              {
                style: {
                  marginLeft: '20px',
                  height: '60px',
                  display: 'flex',
                  alignItems: 'center',
                  minWidth: 0,
                },
              },
              [
                m(`img[width=140][height=60][src=${logo_white}][alt=TNO]`, {
                  style: { marginTop: '2px', flexShrink: 0 },
                }),
                m(
                  '.title.show-on-med-and-up.truncate',
                  {
                    style: {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 'calc(100vw - 720px)',
                    },
                  },
                  attrs.state.modelReady ? attrs.state.model?.scenario?.label : '',
                ),
              ],
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
                className: 'hide-on-large-and-up',
                style: 'margin-left: 5px;',
              }),
            ),
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
                    ).toUpperCase(),
                  ),
                ]),
              ),
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
                    ).toUpperCase(),
                  ),
                ]),
              ),
              ...navUtilities(),
            ),
            m('ul.right.nav-mobile-utilities', navUtilities(true)),
          ]),
        ),
      ),
      m(
        '.container',
        attrs.state.modelReady
          ? children
          : attrs.state.modelLoadError
            ? m('p[role=alert]', t('COLLECTION_LOAD_FAILED'))
            : m(CircularSpinner),
      ),
    ]);
  },
});
