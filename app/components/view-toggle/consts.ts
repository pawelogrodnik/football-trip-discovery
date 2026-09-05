const MOBILE_VIEW = {
  MAP_VIEW: 'map',
  LIST_VIEW: 'list',
} as const;

export type MobileView = (typeof MOBILE_VIEW)[keyof typeof MOBILE_VIEW];

export { MOBILE_VIEW };
