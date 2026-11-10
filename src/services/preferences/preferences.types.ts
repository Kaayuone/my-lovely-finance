/**
 * `account` — a setting of the person that would follow them to another phone (with a restored
 * backup or, later, sync); `device` — state of this installation only.
 */
export type PreferenceScope = 'account' | 'device';

export type PreferenceKey = {
  key: string;
  scope: PreferenceScope;
};
