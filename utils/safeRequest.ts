export async function safeRequest<T, F>(request: PromiseLike<T>, fallback: F): Promise<T | F> {
  try {
    return await request;
  } catch {
    return fallback;
  }
}
