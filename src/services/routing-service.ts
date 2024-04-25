import m, { RouteDefs } from 'mithril';
import { Dashboards, IDashboard } from '../models';
import { Layout } from '../components/layout';
import {
  AboutPage,
  CreateBoxPage,
  CreateScenarioPage,
  DecisionSupportPage,
  HomePage,
  SettingsPage,
  ShowScenarioPage,
} from '../components';
import { cells } from './state-mgmt';
import { t } from './translations';

class RoutingService {
  private dashboards!: ReadonlyArray<IDashboard>;

  constructor() {}

  public init() {
    const routes: IDashboard[] = [
      {
        id: Dashboards.HOME,
        icon: 'home',
        title: t('HOME', 'TITLE'),
        route: t('HOME', 'ROUTE'),
        visible: true,
        default: true,
        component: HomePage,
      },
      {
        id: Dashboards.DEFINE_BOX,
        icon: 'grid_view',
        title: t('DEFINE_BOX', 'TITLE'),
        route: t('DEFINE_BOX', 'ROUTE'),
        visible: true,
        component: CreateBoxPage,
      },
      {
        id: Dashboards.CREATE_SCENARIO,
        icon: 'edit',
        title: t('CREATE_SCENARIO', 'TITLE'),
        route: t('CREATE_SCENARIO', 'ROUTE'),
        visible: true,
        component: CreateScenarioPage,
      },
      {
        id: Dashboards.DECISION_SUPPORT,
        icon: 'assistant_direction',
        title: t('DECISION_SUPPORT', 'TITLE'),
        route: t('DECISION_SUPPORT', 'ROUTE'),
        visible: (scenario) =>
          scenario ? scenario.includeDecisionSupport : false,
        component: DecisionSupportPage,
      },
      {
        id: Dashboards.SHOW_SCENARIO,
        icon: 'visibility',
        title: t('SHOW_SCENARIO', 'TITLE'),
        route: t('SHOW_SCENARIO', 'ROUTE'),
        visible: true,
        component: ShowScenarioPage,
      },
      {
        id: Dashboards.ABOUT,
        icon: 'info',
        title: t('ABOUT', 'TITLE'),
        route: t('ABOUT', 'ROUTE'),
        visible: true,
        component: AboutPage,
      },
      {
        id: Dashboards.SETTINGS,
        icon: 'settings',
        iconClass: 'blue-text',
        title: t('SETTINGS', 'TITLE'),
        route: t('SETTINGS', 'ROUTE'),
        visible: true,
        component: SettingsPage,
      },
    ];
    // console.log(JSON.stringify(routes, null, 2));
    this.setList(routes);
    // console.log(JSON.stringify(this.dashboards, null, 2));
  }

  public getList() {
    return this.dashboards;
  }

  public setList(list: IDashboard[]) {
    this.dashboards = Object.freeze(list);
  }

  public get defaultRoute() {
    const dashboard = this.dashboards.filter((d) => d.default).shift();
    return dashboard ? dashboard.route : this.dashboards[0].route;
  }

  public route(
    dashboardId: Dashboards,
    query?: { [key: string]: string | number | undefined }
  ) {
    const dashboard = this.dashboards
      .filter((d) => d.id === dashboardId)
      .shift();
    return dashboard
      ? '#!' + dashboard.route + (query ? '?' + m.buildQueryString(query) : '')
      : this.defaultRoute;
  }

  public href(dashboardId: Dashboards, params = '' as string | number) {
    const dashboard = this.dashboards
      .filter((d) => d.id === dashboardId)
      .shift();
    return dashboard
      ? `#!${dashboard.route.replace(/:\w*/, '')}${params}`
      : this.defaultRoute;
  }

  public switchTo(
    dashboardId: Dashboards,
    params?: { [key: string]: string | number | undefined },
    query?: { [key: string]: string | number | undefined }
  ) {
    const dashboard = this.dashboards
      .filter((d) => d.id === dashboardId)
      .shift();
    if (dashboard) {
      const url =
        dashboard.route + (query ? '?' + m.buildQueryString(query) : '');
      m.route.set(url, params);
    }
  }

  public routingTable() {
    return this.dashboards.reduce((p, c) => {
      p[c.route] =
        c.hasNavBar === false
          ? {
              render: () => m(c.component, cells()),
            }
          : {
              // onmatch:
              //   c.id === Dashboards.LOGIN
              //     ? undefined
              //     : () => {
              //         if (c.id !== Dashboards.HOME && !Auth.isLoggedIn()) m.route.set('/login');
              //       },
              render: () => m(Layout, cells(), m(c.component, cells())),
            };
      return p;
    }, {} as RouteDefs);
  }
}

export const routingSvc: RoutingService = new RoutingService();
