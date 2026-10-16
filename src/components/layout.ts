import m from 'mithril';
import { Icon, Menu, Sidenav, SidenavItem, ThemeToggle } from 'mithril-materialized';
import logo_white from '../assets/tno_white.svg';
import flagDe from '../assets/flag-de.png';
import flagEn from '../assets/flag-en.png';
import flagEs from '../assets/flag-es.png';
import flagFr from '../assets/flag-fr.png';
import flagNl from '../assets/flag-nl.png';
import flagPl from '../assets/flag-pl.png';
import { IDashboard } from '../models';
import { routingSvc } from '../services/routing-service';
import { MeiosisComponent, changePage, i18n, setLanguage, t } from '../services';
// import { LANGUAGE } from '../utils';
import type { Languages } from '../services/translations';
import { CircularSpinner } from './ui/preloader';
import { DecisionSupportPrompt } from './ui/decision-support-prompt';

const DesktopLanguageMenu = Menu<Languages>();
const MobileLanguageMenu = Menu<Languages>();
const languages: Languages[] = ['nl', 'en', 'fr', 'de', 'es', 'pl'];
const flags: Record<Languages, string> = {
  nl: flagNl,
  en: flagEn,
  fr: flagFr,
  de: flagDe,
  es: flagEs,
  pl: flagPl,
};

export const Layout: MeiosisComponent = () => {
  let isMenuOpen = false;
  let isLanguageSubmenuOpen = false;
  return {
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
            : d.visible(attrs.state?.model?.scenario, attrs.state?.curNarrative)) || isActive(d),
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
        Sidenav,
        {
          id: 'mobile-nav',
          className: 'app-mobile-nav',
          isOpen: isMenuOpen,
          onToggle: (open: boolean) => {
            isMenuOpen = open;
          },
          showBackdrop: true,
          closeOnBackdropClick: true,
          closeOnEscape: true,
        },
        routes.map((d) =>
          m(SidenavItem, {
            text: (typeof d.title === 'string' ? d.title : d.title()).toUpperCase(),
            icon: typeof d.icon === 'string' ? d.icon : d.icon(),
            active: attrs.state.page === d.id,
            className: d.iconClass,
            onclick: (e: Event) => {
              e.preventDefault();
              isMenuOpen = false;
              changePage(attrs, d.id);
            },
          }),
        ),
        m(SidenavItem, { divider: true }),
        m(SidenavItem, {
          text: t('SET_LANGUAGE').toUpperCase(),
          icon: 'language',
          active: isLanguageSubmenuOpen,
          className: 'sidenav-language',
          submenuMode: 'radio',
          onclick: () => {
            isLanguageSubmenuOpen = !isLanguageSubmenuOpen;
          },
          submenu: languages.map((locale) => ({
            text: t('LANGUAGE_NAMES', locale),
            icon: { type: 'image' as const, content: flags[locale] },
            selected: locale === language,
            value: locale,
            onSelect: () => {
              isMenuOpen = false;
              isLanguageSubmenuOpen = false;
              if (locale !== language) setLanguage(attrs, locale);
            },
          })),
        }),
      ),
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
              'a.sidenav-trigger.hide-on-large-and-up',
              {
                href: '#',
                role: 'button',
                title: t('OPEN_MENU'),
                'aria-label': t('OPEN_MENU'),
                'aria-expanded': String(isMenuOpen),
                onclick: (e: MouseEvent) => {
                  e.preventDefault();
                  isMenuOpen = !isMenuOpen;
                },
              },
              m(Icon, { iconName: 'menu', style: 'margin-left: 5px;' }),
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
      attrs.state.modelReady && m(DecisionSupportPrompt, attrs),
    ]);
  },
  };
};
