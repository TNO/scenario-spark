import { ComponentTypes } from 'mithril';
import { Scenario } from './data-model';

export type IconType = () => string | string;

export type IconResolver = () => string;

export interface IDashboard {
  id: Dashboards;
  default?: boolean;
  hasNavBar?: boolean;
  title: string | (() => string);
  icon: string | IconResolver;
  iconClass?: string;
  route: string;
  visible: boolean | ((scenario?: Scenario) => boolean);
  component: ComponentTypes<any, any>;
}

export enum Dashboards {
  HOME = 'HOME',
  ABOUT = 'ABOUT',
  DEFINE_BOX = 'DEFINE_BOX',
  CREATE_SCENARIO = 'CREATE_SCENARIO',
  SHOW_SCENARIO = 'SHOW_SCENARIO',
  DECISION_SUPPORT = 'DECISION_SUPPORT',
  SETTINGS = 'SETTINGS',
  HELP = 'HELP',
}
