import m from 'mithril';
import { t } from '../../services';
import { contrastingColor } from '../../utils';

export interface LegendItem {
  threshold: number;
  color: string;
}

export const LegendComponent = {
  view: ({ attrs }: m.Vnode<{ items: LegendItem[] }>) => {
    const items = [...attrs.items].sort((a, b) => a.threshold - b.threshold);

    return m(
      '.legend',
      {
        role: 'group',
        'aria-label': t('OPTION_USAGE_LEGEND'),
      },
      m(
        '.legend-items',
        items.map((item, index) => {
          const next = items[index + 1];
          const label = !next
            ? `${item.threshold}+`
            : next.threshold === item.threshold + 1
              ? `${item.threshold}`
              : `${item.threshold}-${next.threshold - 1}`;
          return m(
            '.legend-item',
            {
              title: t('OPTION_USAGE_RANGE', { range: label }),
              style: {
                backgroundColor: item.color,
                color: contrastingColor(item.color),
              },
            },
            label,
          );
        }),
      ),
    );
  },
};

export default LegendComponent;
