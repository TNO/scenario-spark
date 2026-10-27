import type { DataModel, ThresholdColor } from './data-model';

export const thresholdColors: ThresholdColor[] = [
  { threshold: 0, color: '#E5E7EB' },
  { threshold: 1, color: '#EFF3FF' },
  { threshold: 3, color: '#BDD7E7' },
  { threshold: 6, color: '#6BAED6' },
  { threshold: 11, color: '#2171B5' },
  { threshold: 21, color: '#084594' },
];

const legacyThresholdColors: ThresholdColor[] = [
  { threshold: 0, color: '#ddeced' },
  { threshold: 1, color: '#FF7800' },
  { threshold: 2, color: '#ffff00' },
  { threshold: 3, color: '#ff0000' },
];

/** Upgrade only the old default palette, leaving custom legends and scenario content intact. */
export const migrateUsageLegends = (model: Partial<Pick<DataModel, 'scenario' | 'scenarios'>>) => {
  let changed = false;
  for (const scenario of [model.scenario, ...(model.scenarios || [])]) {
    if (!scenario) continue;
    const colors = scenario.thresholdColors;
    const legacy = colors?.length === legacyThresholdColors.length &&
      legacyThresholdColors.every((item) =>
        colors.some((color) => color.threshold === item.threshold && color.color.toLowerCase() === item.color.toLowerCase()),
      );
    if (colors && !legacy) continue;
    scenario.thresholdColors = thresholdColors.map((item) => ({ ...item }));
    changed = true;
  }
  return changed;
};
