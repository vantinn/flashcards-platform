export interface AuthenticatedUser {
  id: string;
  email: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  // Compared against User.tokenVersion in AuthService.refresh() — bumping
  // tokenVersion on password reset invalidates every refresh token issued
  // before that point. The access-token path (JwtStrategy) intentionally
  // does not check this — see the session-invalidation note on
  // AuthService.refresh().
  tokenVersion: number;
}
