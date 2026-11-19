import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import AdminLayout from './components/AdminLayout'
import RequireAdminSession from './components/RequireAdminSession'

// Pages
import LoginPage from './pages/LoginPage'
import AdminPage from './pages/AdminPage'
import AvatarsPage from './pages/AvatarsPage'
import PostsPage from './pages/PostsPage'
import ReportsPage from './pages/ReportsPage'
import CategoriesPage from './pages/CategoriesPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAdminSession />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminPage />} />
            <Route path="posts" element={<PostsPage />} />
            <Route path="avatars" element={<AvatarsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
