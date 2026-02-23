export type Select<T, K extends keyof T> = Pick<T, K>;

export enum enuBannableStatus {
  active = 'Active',
  removed = 'Removed',
  banned = 'Banned',
};

export enum enuGenericStatus  {
  active= "Active",
  removed= "Removed"
}

