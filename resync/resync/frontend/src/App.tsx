import { lazy, Suspense } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import AppShell from './components/AppShell';
import { LoadingPanel, PageHeading } from './components/PageStates';
import DashboardPage from './pages/DashboardPage';
import ResourceLibraryPage from './pages/ResourceLibraryPage';
import ResourceDetailPage from './pages/ResourceDetailPage';
import ResourceFormPage from './pages/ResourceFormPage';
import { PopularResourcesPage, RecentResourcesPage } from './pages/CollectionPages';
import SplayTreePage from './pages/SplayTreePage';

const BenchmarkAnalyticsPage = lazy(() => import('./pages/BenchmarkAnalyticsPage'));

function NotFoundPage() {
  return (
    <div className="page-stack">
      <PageHeading title="Page not found" description="This page is not part of the ResourceSync workspace." />
      <section className="panel"><p>The address may be outdated. Return to the dashboard or browse the live library.</p><div className="button-row"><Link className="button button-primary" to="/">Dashboard</Link><Link className="button button-secondary" to="/resources">Resource Library</Link></div></section>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<DashboardPage />} />
        <Route path="resources" element={<ResourceLibraryPage />} />
        <Route path="resources/new" element={<ResourceFormPage />} />
        <Route path="resources/:id/edit" element={<ResourceFormPage />} />
        <Route path="resources/:id" element={<ResourceDetailPage />} />
        <Route path="popular" element={<PopularResourcesPage />} />
        <Route path="recent" element={<RecentResourcesPage />} />
        <Route path="dsa" element={<SplayTreePage />} />
        <Route path="benchmarks" element={<Suspense fallback={<LoadingPanel label="Loading benchmark analytics…" />}><BenchmarkAnalyticsPage /></Suspense>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
