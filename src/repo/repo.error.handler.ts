export const repoErrorHandler = (err: unknown, message = "Error") => {
  if (err instanceof Error) {
    throw new Error(`${message}: ${err.message}`);
  }
  throw new Error(`${message}: ${err}`);
};
