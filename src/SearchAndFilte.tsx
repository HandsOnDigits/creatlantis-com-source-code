// Images
import search_icon from './assets/images/icons/searchIcon.webp'

function Search() {
  return (
    <div>
      <input type="search" placeholder="Search on..."></input>
      <img src={search_icon} className="navigation-icon" />
    </div>
  )
}

function Filter() {
  return <div></div>
}

function SearchAndFilter() {
  return (
    <div className="flex">
      <Search />
      <Filter />
    </div>
  )
}

export default SearchAndFilter
