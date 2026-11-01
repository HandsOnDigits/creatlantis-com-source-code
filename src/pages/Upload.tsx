import { useParams } from 'react-router-dom'

export enum PostType {
  Image,
  Journal,
  // More later...
}

function Upload() {
  const { type } = useParams<{ type: string }>()

  return (
    <div>
      <h2>Upload Page</h2>
      <p>Current Post Type: {type || 'None selected'}</p>
    </div>
  )
}

export default Upload
