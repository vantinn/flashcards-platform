import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { Gender } from '../entities/user.entity.js';

// The only two selectable onboarding avatars — static assets already
// shipped in the web app's /public/avatars folder (see section 4/5 of the
// onboarding feature request). Anything else, including a full URL, is
// rejected rather than accepted and stored.
export const ONBOARDING_AVATARS = ['1.png', '2.png'] as const;
export type OnboardingAvatar = (typeof ONBOARDING_AVATARS)[number];

export class OnboardingDto {
  // Required — the whole point of this endpoint is that onboarding cannot
  // complete without it. No "unspecified"/default value is accepted.
  @IsEnum(Gender)
  gender: Gender;

  @IsOptional()
  @IsIn(ONBOARDING_AVATARS)
  avatar?: OnboardingAvatar;
}
