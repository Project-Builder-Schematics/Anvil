/** The provider barrels export no error classes, so a refusal is told apart by its `code`. */
export const refusalCode = (error: unknown): unknown =>
  error instanceof Error && 'code' in error ? error.code : undefined;
