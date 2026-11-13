import { useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import NavigationBar from './NavigationBar'
import Home from './pages/Home'
import Upload from './pages/Upload'
import Login from './pages/Login'
import Post from './pages/Post'
import ProtectedRoute from './ProtectedRoute'
import { useLive } from './LiveContext'

function App() {
  const { connected, subscribe } = useLive()

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
      <NavigationBar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/posts/:id" element={<Post />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/upload/:type" element={<Upload />} />
          <Route path="/upload" element={<Upload />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
