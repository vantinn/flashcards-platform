import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marks a route as exempt from the global JwtAuthGuard. The guard denies by
 * default; routes opt out explicitly instead of every guard opting in,
 * which is the safer default for an app with only one auth'd role.
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
