import axe from 'axe-core';

/**
 * One line per axe violation in `element`: `<rule>: <selectors>`. Colour contrast is off because
 * jsdom has no layout; check it in the browser.
 */
export const axeViolations = async (element: Element): Promise<string[]> => {
  const { violations } = await axe.run(element, {
    rules: { 'color-contrast': { enabled: false } },
  });
  return violations.map(
    ({ id, nodes }) =>
      `${id}: ${nodes.map((node) => node.target.join(' ')).join(', ')}`,
  );
};
