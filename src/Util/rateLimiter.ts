interface RateRecord {
    count: number;
    firstRequestAt: number;
}

export function createRateLimiter(windowMs: number, maxRequests: number) {
    // Each instance created gets its own separate map
    const attempts = new Map<string, RateRecord>();

    return function canProceed(key: string): boolean {
        const now = Date.now();
        const record = attempts.get(key);

        if (!record) {
            attempts.set(key, { count: 1, firstRequestAt: now });
            return true;
        }

        if (now - record.firstRequestAt > windowMs) {
            attempts.set(key, { count: 1, firstRequestAt: now });
            return true;
        }

        if (record.count >= maxRequests) {
            return false;
        }

        record.count++;
        return true;
    };
}

import { AppConstant } from '../constants/AppConstant';

// Create your specific rate limiter
export const canMatch = createRateLimiter(
    AppConstant.RATE_LIMIT_WINDOW_MS,
    AppConstant.RATE_LIMIT_MAX_MATCHES
);
