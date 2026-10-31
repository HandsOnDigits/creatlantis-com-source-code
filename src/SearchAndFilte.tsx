// Images
import search_icon from './assets/images/icons/searchIcon.webp'

function Search() {
  return (
    <div className="flex items-center gap-4">
      <label htmlFor="search">Find:</label>
      <input
        type="search"
        placeholder="Search on..."
        name="search"
        id="search"
      />
      <img src={search_icon} className="navigation-icon" alt="" />
    </div>
  )
}

function Filter() {
  return (
    <div className="flex items-center gap-4">
      <label htmlFor="post-type">Show only:</label>
      <select name="post-type" id="post-type">
        <option value="someOption">Some option</option>
        <option value="otherOption">Other option</option>
      </select>

      <label htmlFor="post-order">Order by:</label>
      <select name="post-order" id="post-order">
        <option value="someOption">Some option</option>
        <option value="otherOption">Other option</option>
      </select>
    </div>
  )
}

function SearchAndFilter() {
  return (
    <div className="flex w-full items-center justify-center gap-6">
      <Search />
      <Filter />
    </div>
  )
}

export default SearchAndFilter
