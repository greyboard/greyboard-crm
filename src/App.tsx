import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useSettings } from './hooks/useSettings'
import { Layout } from './components/Layout'
import { RequireAuth } from './components/RequireAuth'
import { PageLoader } from './components/PageLoader'
import { Login } from './pages/Login'
import { lazy, Suspense } from 'react'
import { Dashboard } from './pages/Dashboard'
const Templates     = lazy(() => import('./pages/Templates').then(m => ({ default: m.Templates })))
const Einstellungen = lazy(() => import('./pages/Einstellungen').then(m => ({ default: m.Einstellungen })))
const Kontakte      = lazy(() => import('./pages/Kontakte').then(m => ({ default: m.Kontakte })))
const Queue         = lazy(() => import('./pages/Queue').then(m => ({ default: m.Queue })))
const Auswertung    = lazy(() => import('./pages/Auswertung').then(m => ({ default: m.Auswertung })))

export default function App() {
  useSettings()
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="kontakte"      element={<Suspense fallback={<PageLoader />}><Kontakte /></Suspense>} />
          <Route path="queue"         element={<Suspense fallback={<PageLoader />}><Queue /></Suspense>} />
          <Route path="templates"     element={<Suspense fallback={<PageLoader />}><Templates /></Suspense>} />
          <Route path="auswertung"    element={<Suspense fallback={<PageLoader />}><Auswertung /></Suspense>} />
          <Route path="einstellungen" element={<Suspense fallback={<PageLoader />}><Einstellungen /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
