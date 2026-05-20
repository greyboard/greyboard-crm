import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useSettings } from './hooks/useSettings'
import { Layout } from './components/Layout'
import { lazy, Suspense } from 'react'
import { Dashboard } from './pages/Dashboard'
const Templates     = lazy(() => import('./pages/Templates').then(m => ({ default: m.Templates })))
const Einstellungen = lazy(() => import('./pages/Einstellungen').then(m => ({ default: m.Einstellungen })))
const Kontakte      = lazy(() => import('./pages/Kontakte').then(m => ({ default: m.Kontakte })))

export default function App() {
  useSettings() // Theme auf documentElement anwenden
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="kontakte" element={<Suspense fallback={null}><Kontakte /></Suspense>} />
          <Route path="templates" element={<Suspense fallback={null}><Templates /></Suspense>} />
          <Route path="einstellungen" element={<Suspense fallback={null}><Einstellungen /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
