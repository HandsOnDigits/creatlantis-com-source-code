// Images
import search_icon from './assets/images/icons/searchIcon.webp'

export type CollectionType = 'posts' | 'users'
export type CollectionSort = 'newest' | 'alphabetical'

interface SearchAndFilterProps {
  collectionType: CollectionType
  search: string
  sort: CollectionSort
  onCollectionTypeChange: (value: CollectionType) => void
  onSearchChange: (value: string) => void
  onSortChange: (value: CollectionSort) => void
}

function SearchAndFilter({
  collectionType,
  search,
  sort,
  onCollectionTypeChange,
  onSearchChange,
  onSortChange,
}: SearchAndFilterProps) {
  return (
    <div className="flex w-full flex-wrap items-center justify-center gap-6">
      <div className="flex items-center gap-4">
        <label htmlFor="search">Find:</label>
        <input
          className="navigation-input"
          type="search"
          placeholder={
            collectionType === 'users'
              ? 'Search usernames...'
              : 'Search posts...'
          }
          name="search"
          id="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
        <img src={search_icon} className="navigation-icon" alt="" />
      </div>

      <div className="flex items-center gap-4">
        <label htmlFor="collection-type">Browse:</label>
        <select
          id="collection-type"
          className="navigation-input"
          value={collectionType}
          onChange={(event) =>
            onCollectionTypeChange(event.target.value as CollectionType)
          }
        >
          <option value="posts">Posts</option>
          <option value="users">Users</option>
        </select>

        <label htmlFor="collection-order">Order by:</label>
        <select
          id="collection-order"
          className="navigation-input"
          value={sort}
          onChange={(event) =>
            onSortChange(event.target.value as CollectionSort)
          }
        >
          <option value="newest">Newest</option>
          <option value="alphabetical">Alphabetical</option>
        </select>
      </div>
    </div>
  )
}

export default SearchAndFilter
