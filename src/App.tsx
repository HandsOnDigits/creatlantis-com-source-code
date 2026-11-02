import { BrowserRouter, Routes, Route } from 'react-router-dom'

import NavigationBar from './NavigationBar'
import Home from './pages/Home'
import Upload from './pages/Upload'
import Login from './pages/Login'
import ProtectedRoute from './ProtectedRoute'

function App() {
  return (
    <BrowserRouter>
      <NavigationBar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/upload/:type" element={<Upload />} />
          <Route path="/upload" element={<Upload />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
