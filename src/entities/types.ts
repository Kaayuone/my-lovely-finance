export interface Audit {
  created_at: string;
  updated_at: string;
}

// Omit over a union keeps only the keys shared by every member, so a discriminated entity type has
// to be omitted member by member
export type DistributiveOmit<T, K extends keyof never> = T extends unknown ? Omit<T, K> : never;
