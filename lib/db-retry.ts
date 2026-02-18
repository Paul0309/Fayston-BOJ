export async function withDbRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 120): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (error: unknown) {
            lastError = error;
            const code = typeof error === "object" && error !== null && "code" in error ? (error as { code?: string }).code : undefined;
            const retriable = code === "P1008";

            if (!retriable || attempt === retries) {
                throw error;
            }

            await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
        }
    }

    throw lastError;
}
