import type {
  Post,
  PublicProfile,
  PublicProfileCustomization,
  ProfileLayout,
} from '../../api'

import ProfileWidget from './ProfileWidget'

interface ProfileTabProps {
  profile: PublicProfile
  customization: PublicProfileCustomization | null
  layout: ProfileLayout

  galleryPosts: Post[]
  galleryLoading: boolean
  galleryHasMore: boolean
  onLoadMoreGallery: () => void

  spotlightPosts: Post[]
  onEditSpotlight: (widgetId: string) => void

  journalPosts: Post[]
  journalLoading: boolean
  journalHasMore: boolean
  onLoadMoreJournal: () => void

  canEditWidgets: boolean
  onUpdateWidgetConfig: (
    widgetId: string,
    field: 'title' | 'content' | 'postIds',
    value: string | number[],
  ) => Promise<void>
  savingWidgetConfig: boolean
  widgetConfigError: string | null
}

function ProfileTab({
  profile,
  customization,
  layout,
  galleryPosts,
  galleryLoading,
  galleryHasMore,
  onLoadMoreGallery,
  journalPosts,
  journalLoading,
  journalHasMore,
  onLoadMoreJournal,
  spotlightPosts,
  onEditSpotlight,
  canEditWidgets,
  onUpdateWidgetConfig,
  savingWidgetConfig,
  widgetConfigError,
}: ProfileTabProps) {
  const mainColumn = layout.columns.find((column) => column.id === 'main')
  const sidebarColumn = layout.columns.find((column) => column.id === 'sidebar')

  function renderWidget(
    widget: (typeof layout.columns)[number]['widgets'][number],
  ) {
    if (widget.type === 'header') return null

    return (
      <ProfileWidget
        key={widget.id}
        widget={widget}
        profile={profile}
        customization={customization}
        galleryPosts={galleryPosts}
        galleryLoading={galleryLoading}
        galleryHasMore={galleryHasMore}
        onLoadMoreGallery={onLoadMoreGallery}
        spotlightPosts={spotlightPosts}
        onEditSpotlight={onEditSpotlight}
        journalPosts={journalPosts}
        journalLoading={journalLoading}
        journalHasMore={journalHasMore}
        onLoadMoreJournal={onLoadMoreJournal}
        canEditWidgets={canEditWidgets}
        onUpdateWidgetConfig={onUpdateWidgetConfig}
        savingWidgetConfig={savingWidgetConfig}
        widgetConfigError={widgetConfigError}
      />
    )
  }

  return (
    <div className="grid grid-cols-1 gap-8 p-6 lg:grid-cols-3">
      <div className="min-w-0 lg:col-span-2">
        {mainColumn?.widgets.map(renderWidget)}
      </div>

      <aside className="min-w-0">
        {sidebarColumn?.widgets.map(renderWidget)}
      </aside>
    </div>
  )
}

export default ProfileTab
