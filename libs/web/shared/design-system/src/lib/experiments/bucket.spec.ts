import { hash, pickVariant } from './bucket';

const split = [
  { name: 'control', weight: 50 },
  { name: 'b', weight: 50 },
];

describe('pickVariant', () => {
  it('is deterministic per experiment and subject', () => {
    expect(hash('a')).toBe(hash('a'));
    expect(pickVariant('theme', 'subject-1', split)).toBe(
      pickVariant('theme', 'subject-1', split),
    );
  });

  it('spreads a 50/50 split roughly evenly', () => {
    const inB = Array.from({ length: 10_000 }, (_, index) =>
      pickVariant('theme', `subject-${String(index)}`, split),
    ).filter((variant) => variant.name === 'b').length;
    expect(inB).toBeGreaterThan(4_500);
    expect(inB).toBeLessThan(5_500);
  });

  it('honours weights and never picks a zero-weight variant', () => {
    const skewed = [
      { name: 'control', weight: 90 },
      { name: 'never', weight: 0 },
      { name: 'b', weight: 10 },
    ];
    const picks = Array.from(
      { length: 10_000 },
      (_, index) => pickVariant('x', `s-${String(index)}`, skewed).name,
    );
    expect(picks).not.toContain('never');
    const inB = picks.filter((name) => name === 'b').length;
    expect(inB).toBeGreaterThan(700);
    expect(inB).toBeLessThan(1_300);
  });

  it('decorrelates experiments for the same subject', () => {
    const differing = Array.from({ length: 1_000 }, (_, index) => {
      const subject = `s-${String(index)}`;
      return (
        pickVariant('one', subject, split).name !==
        pickVariant('two', subject, split).name
      );
    }).filter(Boolean).length;
    expect(differing).toBeGreaterThan(300);
  });

  it('rejects variants without positive weight', () => {
    expect(() => pickVariant('x', 's', [{ name: 'a', weight: 0 }])).toThrow(
      'positive weight',
    );
  });
});
