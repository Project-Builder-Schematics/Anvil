import { axeViolations } from './axe';

const render = (html: string): HTMLElement => {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host;
};

describe('axeViolations', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('finds nothing in accessible markup', async () => {
    const host = render(
      '<main><h1>Orders</h1><label for="q">Product</label><input id="q" /></main>',
    );

    expect(await axeViolations(host)).toEqual([]);
  });

  it('names each rule that fails and where', async () => {
    const host = render('<main><h1>Orders</h1><input id="q" /></main>');

    expect(await axeViolations(host)).toEqual([
      expect.stringMatching(/^label: .*#q/),
    ]);
  });
});
