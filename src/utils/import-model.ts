import type { DataModel, OldDataModel, Scenario } from '../models/data-model';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isInconsistencies = (value: unknown): boolean =>
  isRecord(value) &&
  Object.values(value).every(
    (row) =>
      isRecord(row) &&
      Object.values(row).every((entry) => typeof entry === 'boolean')
  );

const isScenario = (value: unknown): value is Scenario =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  value.id.trim().length > 0 &&
  typeof value.label === 'string' &&
  value.label.trim().length > 0 &&
  Array.isArray(value.categories) &&
  value.categories.every(
    (category: unknown) =>
      isRecord(category) &&
      typeof category.id === 'string' &&
      typeof category.label === 'string' &&
      (category.componentIds === undefined ||
        (Array.isArray(category.componentIds) &&
          category.componentIds.every((id: unknown) => typeof id === 'string')))
  ) &&
  Array.isArray(value.components) &&
  value.components.every(
    (component: unknown) =>
      isRecord(component) &&
      typeof component.id === 'string' &&
      typeof component.label === 'string' &&
      (component.values === undefined ||
        (Array.isArray(component.values) &&
          component.values.every(
            (item: unknown) =>
              isRecord(item) &&
              typeof item.id === 'string' &&
              typeof item.label === 'string'
          )))
  ) &&
  (value.narratives === undefined ||
    (Array.isArray(value.narratives) &&
      value.narratives.every(
        (narrative: unknown) =>
          isRecord(narrative) &&
          isRecord(narrative.components) &&
          Object.values(narrative.components).every(
            (ids) =>
              Array.isArray(ids) &&
              ids.every((id) => typeof id === 'string')
          )
      ))) &&
  (value.inconsistencies === undefined ||
    isInconsistencies(value.inconsistencies));

const isOldModel = (value: Record<string, unknown>): value is OldDataModel => {
  if (!isRecord(value.scenarios) || !isRecord(value.scenarios.current))
    return false;
  const current = value.scenarios.current;
  return (
    typeof current.id === 'string' &&
    typeof current.name === 'string' &&
    isRecord(current.categories) &&
    Object.values(current.categories).every(
      (ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string')
    ) &&
    Array.isArray(current.inconsistencies) &&
    current.inconsistencies.every(
      (item: unknown) =>
        isRecord(item) &&
        Array.isArray(item.ids) &&
        item.ids.length === 2 &&
        item.ids.every((id: unknown) => typeof id === 'string') &&
        (item.type === 'partly' || item.type === 'totally')
    ) &&
    Array.isArray(current.narratives) &&
    current.narratives.every(
      (item: unknown) =>
        isRecord(item) &&
        isRecord(item.components) &&
        Object.values(item.components).every((id) => typeof id === 'string')
    ) &&
    Object.entries(value).every(
      ([key, entry]) =>
        key === 'scenarios' ||
        (isRecord(entry) &&
          Array.isArray(entry.list) &&
          entry.list.every(
            (item: unknown) =>
              isRecord(item) &&
              typeof item.id === 'string' &&
              typeof item.name === 'string' &&
              (item.context === undefined ||
                (isRecord(item.context) && isRecord(item.context.data)))
          ))
    )
  );
};

export const parseImportedModel = (
  content: string
):
  | { kind: 'scenario'; value: Scenario }
  | { kind: 'collection'; value: DataModel }
  | { kind: 'legacy'; value: OldDataModel } => {
  const value: unknown = JSON.parse(content);
  if (isRecord(value)) {
    if (
      isScenario(value.scenario) &&
      Array.isArray(value.scenarios) &&
      value.scenarios.every(isScenario)
    ) {
      return { kind: 'collection', value: value as DataModel };
    }
    if (isOldModel(value)) return { kind: 'legacy', value };
  }
  if (isScenario(value)) return { kind: 'scenario', value };
  throw new Error('Invalid Scenario Spark model');
};
