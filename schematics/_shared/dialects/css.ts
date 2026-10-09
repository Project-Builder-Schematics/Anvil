import postcss, { type Root } from 'postcss';
// `defineDialect` is exported from no public subpath of the SDK (0.3.1); see html.ts.
import { defineDialect } from '../../../node_modules/@pbuilder/sdk/dist/core/define-dialect.js';

export const css = defineDialect({
  extensions: ['.css'],
  ast: {
    parse: (source: string): Root => postcss.parse(source),
    print: (root: Root): string => root.toString(),
  },
  ops: {},
});
