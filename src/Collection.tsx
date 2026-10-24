import { useState } from 'react'

import { Journal, Image } from './PostElements'
import { HorizontalHR } from './Utilites'

const categoryNames = {
  ALL: 'All',
  DRAWINGS: 'Drawings',
  PAINTINGS: 'Paintings',
  OTHER: 'Other',
} as const

type Category = (typeof categoryNames)[keyof typeof categoryNames]

// --- Updated Mock Data using Journal & Image types ---
const collectionItems = [
  {
    id: 1,
    category: 'Drawings',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=600&auto=format&fit=crop&q=60',
    title: 'Charcoal Sketch Study',
  },
  {
    id: 2,
    category: 'Paintings',
    type: 'journal',
    content:
      '<p>Reflecting on the color palette used in this series. The interplay between warm earth tones and cool blues creates a striking contrast.</p>',
    title: 'Artist Notes',
  },
  {
    id: 3,
    category: 'Other',
    type: 'image',
    url: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=600&auto=format&fit=crop&q=60',
    title: 'Studio Setup',
  },
  {
    id: 4,
    category: 'Drawings',
    type: 'journal',
    content: `The standard Lorem Ipsum passage, used since 1966
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
    
    Section 1.10.32 of "de Finibus Bonorum et Malorum", written by Cicero in 45 BC
    "Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo. Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem. Ut enim ad minima veniam, quis nostrum exercitationem ullam corporis suscipit laboriosam, nisi ut aliquid ex ea commodi consequatur? Quis autem vel eum iure reprehenderit qui in ea voluptate velit esse quam nihil molestiae consequatur, vel illum qui dolorem eum fugiat quo voluptas nulla pariatur?"
    
    1914 translation by H. Rackham
    "But I must explain to you how all this mistaken idea of denouncing pleasure and praising pain was born and I will give you a complete account of the system, and expound the actual teachings of the great explorer of the truth, the master-builder of human happiness. No one rejects, dislikes, or avoids pleasure itself, because it is pleasure, but because those who do not know how to pursue pleasure rationally encounter consequences that are extremely painful. Nor again is there anyone who loves or pursues or desires to obtain pain of itself, because it is pain, but because occasionally circumstances occur in which toil and pain can procure him some great pleasure. To take a trivial example, which of us ever undertakes laborious physical exercise, except to obtain some advantage from it? But who has any right to find fault with a man who chooses to enjoy a pleasure that has no annoying consequences, or one who avoids a pain that produces no resultant pleasure?"
    
    Section 1.10.33 of "de Finibus Bonorum et Malorum", written by Cicero in 45 BC
    "At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident, similique sunt in culpa qui officia deserunt mollitia animi, id est laborum et dolorum fuga. Et harum quidem rerum facilis est et expedita distinctio. Nam libero tempore, cum soluta nobis est eligendi optio cumque nihil impedit quo minus id quod maxime placeat facere possimus, omnis voluptas assumenda est, omnis dolor repellendus. Temporibus autem quibusdam et aut officiis debitis aut rerum necessitatibus saepe eveniet ut et voluptates repudiandae sint et molestiae non recusandae. Itaque earum rerum hic tenetur a sapiente delectus, ut aut reiciendis voluptatibus maiores alias consequatur aut perferendis doloribus asperiores repellat."
    
    1914 translation by H. Rackham
    "On the other hand, we denounce with righteous indignation and dislike men who are so beguiled and demoralized by the charms of pleasure of the moment, so blinded by desire, that they cannot foresee the pain and trouble that are bound to ensue; and equal blame belongs to those who fail in their duty through weakness of will, which is the same as saying through shrinking from toil and pain. These cases are perfectly simple and easy to distinguish. In a free hour, when our power of choice is untrammelled and when nothing prevents our being able to do what we like best, every pleasure is to be welcomed and every pain avoided. But in certain circumstances and owing to the claims of duty or the obligations of business it will frequently occur that pleasures have to be repudiated and annoyances accepted. The wise man therefore always holds in these matters to this principle of selection: he rejects pleasures to secure other greater pleasures, or else he endures pains to avoid worse pains."</p>`,
    title: 'Gesture Notes',
  },
  {
    id: 5,
    category: 'Paintings',
    type: 'image',
    url: 'data:image/jpeg;base64,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',
    title: 'Sunset Oil Painting',
  },
]

function Collection() {
  const [selectedCategory, setSelectedCategory] = useState<Category>(
    categoryNames.ALL,
  )
  const categories = Object.values(categoryNames)

  const filteredItems =
    selectedCategory === categoryNames.ALL
      ? collectionItems
      : collectionItems.filter((item) => item.category === selectedCategory)

  return (
    <div className="flex min-h-screen">
      {/* Category Selection */}
      <ol
        id="category-list"
        className="w-[18vw] space-y-2 p-4 text-nowrap lg:w-[8vw]"
      >
        {categories.map((category) => (
          <li
            key={category}
            className={`transition-colors ${
              selectedCategory === category ? 'selected-index' : ''
            }`}
            onClick={() => setSelectedCategory(category)}
            style={{ cursor: 'pointer' }}
          >
            {category}
          </li>
        ))}
      </ol>

      {/* Selected Category Display */}
      <div className="flex min-h-0 flex-1 flex-col p-6">
        <h2 className="big-text font-bold">{selectedCategory} Posts</h2>
        <HorizontalHR />

        {/* Scrollable Container Wrapper */}
        <div className="h-[90vh] scrollbar-none overflow-y-auto">
          {/* Masonry Layout Container */}
          <div className="columns-1 gap-6 space-y-6 sm:columns-2 lg:columns-3">
            {filteredItems.map((item) => (
              <div key={item.id} className="break-inside-avoid">
                {/* Conditional rendering based on item type */}
                {item.type === 'image' && (
                  <Image url={item.url} alt={item.title} />
                )}
                {item.type === 'journal' && <Journal content={item.content} />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Collection
