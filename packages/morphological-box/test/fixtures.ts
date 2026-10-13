import type { MorphologicalBox } from '../src/index.ts';

export const sampleBox = (): MorphologicalBox => ({
  id: 'box',
  label: 'Box',
  categories: [
    { id: 'actor', label: 'Actor', componentIds: ['motive', 'capability'] },
    { id: 'target', label: 'Target', componentIds: ['asset'] },
  ],
  components: [
    { id: 'motive', label: 'Motive', values: [{ id: 'money', label: 'Money' }, { id: 'ideology', label: 'Ideology' }] },
    { id: 'capability', label: 'Capability', values: [{ id: 'low', label: 'Low' }, { id: 'high', label: 'High' }] },
    { id: 'asset', label: 'Asset', values: [{ id: 'bank', label: 'Bank' }, { id: 'grid', label: 'Power grid' }] },
  ],
  inconsistencies: {},
});
