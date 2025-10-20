import m from 'mithril';
import 'material-icons/iconfont/filled.css';
import 'mithril-materialized/index.min.css';
import 'mithril-markdown-wysiwyg/css';
import './css/style.css';
import { routingSvc } from './services/routing-service';
import { Languages, i18n } from './services';
import { LANGUAGE, SAVED } from './utils';

export const AllLanguages = {
  en: { name: 'English', fqn: 'en-UK' },
  nl: { name: 'Nederlands', fqn: 'nl-NL', default: true },
};

window.onbeforeunload = (e) => {
  if (localStorage.getItem(SAVED) === 'true') return;
  localStorage.setItem(SAVED, 'true');
  e.preventDefault(); // This is necessary for older browsers
  // e.returnValue = ''; // For modern browsers
};

i18n.addOnChangeListener((_locale: string) => {
  console.log(`Language loaded`);
  routingSvc.init();
  m.route(document.body, routingSvc.defaultRoute, routingSvc.routingTable());
});
i18n.init(
  AllLanguages,
  (window.localStorage.getItem(LANGUAGE) || 'nl') as Languages
);
