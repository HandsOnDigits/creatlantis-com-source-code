import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import type { CollectionType, CollectionSort } from './SearchAndFilter'

import { useLive } from './LiveContext'

// Pages
import NavigationBar from './NavigationBar'
import Home from './pages/Home'
import Upload from './pages/Upload'
import Login from './pages/Login'
import Register from './pages/Register'
import Post from './pages/Post'
import ProtectedRoute from './ProtectedRoute'
import Profile from './pages/Profile'
import ProfileEditor from './pages/ProfileEditor'
import Settings from './pages/settings'
import Notes from './pages/Notes'

function App() {
  const { connected, subscribe } = useLive()

  const [collectionType, setCollectionType] = useState<CollectionType>('posts')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<CollectionSort>('newest')

  useEffect(() => {
    const unsubscribe = subscribe((event) => {
      console.log('Live event received:', event)
    })

    return unsubscribe
  }, [subscribe])

  useEffect(() => {
    console.log('Live connection:', connected ? 'Connected' : 'Disconnected')
  }, [connected])

  return (
    <BrowserRouter>
      <NavigationBar
        collectionType={collectionType}
        search={search}
        sort={sort}
        onCollectionTypeChange={setCollectionType}
        onSearchChange={setSearch}
        onSortChange={setSort}
      />

      <Routes>
        <Route
          path="/"
          element={
            <Home collectionType={collectionType} search={search} sort={sort} />
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/posts/:id" element={<Post />} />
        <Route path="/settings" element={<Settings />} />

        {/* Public profile */}
        <Route path="/profile/:username" element={<Profile />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/upload/:type" element={<Upload />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/profile/edit" element={<ProfileEditor />} />
          <Route path="/notes" element={<Notes />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
