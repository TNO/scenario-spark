import m from 'mithril';

export interface LegendItem {
  threshold: number;
  color: string;
}

// Utility function to determine text color based on background brightness
const getContrastColor = (backgroundColor: string): string => {
  // Remove # if present
  const hex = backgroundColor.replace('#', '');

  // Convert hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Calculate brightness
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;

  // Return black for light backgrounds, white for dark backgrounds
  return brightness > 125 ? 'black' : 'white';
};

export const LegendComponent = {
  view: ({ attrs }: m.Vnode<{ items: LegendItem[] }>) => {
    const { items } = attrs;

    return m(
      '.legend',
      {
        style: { display: 'fixed' },
      },
      m(
        '.legend-items',
        {
          style: {
            // position: 'fixed',
            top: 0,
            right: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px', // equivalent to space-x-2
          },
        },
        items.map((item, index) =>
          m(
            'div',
            {
              key: index,
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '40px', // w-10
                height: '40px', // h-10
                backgroundColor: item.color,
                color: getContrastColor(item.color),
                borderRadius: '8px', // Optional: to match the rounded look
              },
            },
            index === items.length - 1
              ? `${item.threshold}+`
              : `${item.threshold}x`
          )
        )
      )
    );
  },
};

export default LegendComponent;
