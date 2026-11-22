import Collection from '../Collection'
import type { CollectionType, CollectionSort } from '../SearchAndFilter'

interface HomeProps {
  collectionType: CollectionType
  search: string
  sort: CollectionSort
}

function Home({ collectionType, search, sort }: HomeProps) {
  return (
    <Collection collectionType={collectionType} search={search} sort={sort} />
  )
}

export default Home
