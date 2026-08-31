import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Used on routes that behave differently for signed-in vs anonymous callers
 * (e.g. viewing a flashcard set: owners can see their private sets, anyone
 * can see public ones). Unlike JwtAuthGuard, a missing or invalid token is
 * not an error here — request.user is just left undefined so the handler
 * can apply its own visibility rules.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Without an explicit constructor here, Nest reflects constructor
  // parameter metadata from the parent AuthGuard('jwt') mixin instead
  // (its own optional AuthModuleOptions param), and fails to resolve it in
  // whatever module declares the controller this guard is applied to. An
  // explicit no-arg constructor — the same fix JwtAuthGuard needs a
  // Reflector for — sidesteps that reflection entirely.
  constructor() {
    super();
  }

  handleRequest<TUser = unknown>(_err: unknown, user: TUser | false): TUser | undefined {
    return user ? user : undefined;
  }
}
