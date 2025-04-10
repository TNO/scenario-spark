import m from 'mithril';
import 'material-icons/iconfont/filled.css';
import 'materialize-css/dist/css/materialize.min.css';
import 'materialize-css/dist/js/materialize.min.js';
import './css/style.css';
import 'quill/dist/quill.snow.css';
import { routingSvc } from './services/routing-service';
import { Languages, i18n } from './services';
import { LANGUAGE, SAVED } from './utils';

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
  {
    en: { name: 'English', fqn: 'en-UK', default: true },
    nl: { name: 'Nederlands', fqn: 'nl-NL' },
  },
  (window.localStorage.getItem(LANGUAGE) || 'nl') as Languages
);
