import { BrowserRouter, Routes, Route } from 'react-router-dom'
import NavigationBar from './NavigationBar'
import Home from './pages/Home'
import Upload from './pages/Upload'

function App() {
  return (
    <BrowserRouter>
      <NavigationBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/upload/:type" element={<Upload />} />
        {/* Optional fallback route if someone visits /upload without a type */}
        <Route path="/upload" element={<Upload />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
