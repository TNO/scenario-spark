export interface IBasicContent {
  id: string;
  name: string;
  desc?: string;
  type: string;
}

export type ContentCategory = 'THREAT' | 'CONTEXT' | 'SCENARIO';
export const ContextTypes = ['NONE', 'LOCATION', 'LOCATIONTYPE'] as const;
export type ContextType = typeof ContextTypes[number];
export const LocationTypes = ['NAME', 'COORDINATES'] as const;
export type LocationType = typeof LocationTypes[number];
export type LocationContext = { [key in LocationType]: string };
export const LocationTypeTypes = ['LIST', 'CUSTOM'] as const;
export type LocationTypeType = typeof LocationTypeTypes[number];
export type LocationTypeContext = { [key in LocationTypeType]: string };

export interface IContext {
  type: ContextType;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

export interface IContent extends IBasicContent {
  category: ContentCategory;
  context?: IContext;
}
