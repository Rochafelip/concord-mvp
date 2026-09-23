/**
 * Split out of apiClient.ts so queryClient.ts (which needs the class for its retry check) can
 * import it without pulling in apiClient.ts, which itself imports authStore.ts, which imports
 * queryClient.ts — that would be a cycle.
 */
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}
