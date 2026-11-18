export const PROFILE_WIDGET_TYPES = [
  'header',
  'bio',
  'gallery',
  'journal',
  'statistics',
  'featured',
  'customText',
  'links',
  'friends',
] as const

export type ProfileWidgetType = (typeof PROFILE_WIDGET_TYPES)[number]
