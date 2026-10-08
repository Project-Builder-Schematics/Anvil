import { HtmlParser, type ParseTreeResult } from '@angular/compiler';
// The SDK documents `defineDialect` for dialect authors but exports it from no public
// subpath (0.3.1), so it is imported by file. The path resolves to the module the SDK's own
// typescript dialect uses, which keeps one copy of the run context.
import { defineDialect } from '../../../node_modules/@pbuilder/sdk/dist/core/define-dialect.js';

/**
 * A parsed template and the edits made to it. Angular has no printer for its HTML tree, so
 * edits are offset splices over the original source and everything else is printed untouched.
 */
export class HtmlAst {
  readonly #splices: Array<{ start: number; end: number; text: string }> = [];

  constructor(
    readonly source: string,
    readonly nodes: ParseTreeResult['rootNodes'],
  ) {}

  /** Replaces `source[start, end)` when the file is printed; `start === end` inserts. */
  splice(start: number, end: number, text: string): void {
    if (start < 0 || end < start || end > this.source.length)
      throw new Error(
        `splice range ${String(start)}-${String(end)} is outside the source`,
      );
    this.#splices.push({ start, end, text });
  }

  print(): string {
    let out = '';
    let at = 0;
    for (const { start, end, text } of [...this.#splices].sort(
      (a, b) => a.start - b.start || a.end - b.end,
    )) {
      if (start < at) throw new Error('splices overlap');
      out += this.source.slice(at, start) + text;
      at = end;
    }
    return out + this.source.slice(at);
  }
}

export const html = defineDialect({
  extensions: ['.html'],
  ast: {
    parse: (source: string): HtmlAst => {
      const { rootNodes, errors } = new HtmlParser().parse(
        source,
        'template.html',
        {
          tokenizeExpansionForms: true,
          tokenizeBlocks: true,
        },
      );
      if (errors.length > 0)
        throw new Error(errors.map((e) => e.msg).join('; '));
      return new HtmlAst(source, rootNodes);
    },
    print: (ast: HtmlAst): string => ast.print(),
  },
  ops: {},
});
