import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ResourceSearch from '../components/ResourceSearch';
import ResourceDetailPage from '../pages/ResourceDetailPage';
import ResourceFormPage from '../pages/ResourceFormPage';
import SplayTreePage from '../pages/SplayTreePage';
import BenchmarkAnalyticsPage from '../pages/BenchmarkAnalyticsPage';
import type { Resource, ResourcePage, SearchMetrics, TreeSnapshot } from '../api/types';

const sampleResource = (id: number, title: string): Resource => ({
  id,
  title,
  description: 'An illustrative resource for UI tests.',
  category: 'Lecture Notes',
  resourceType: 'PDF',
  subject: 'Computer Science',
  academicTerm: 'Year 2 · Semester 1',
  resourceUrl: null,
  resourceReference: null,
  tags: ['dsa', 'lecture'],
  createdAt: '2026-10-01T12:00:00Z',
  updatedAt: '2026-10-01T12:00:00Z',
  sample: true,
  accessCount: 3,
  lastAccessed: '2026-10-10T09:10:00Z',
});

const pageOf = (items: Resource[], size = 50): ResourcePage => ({ items, page: 0, size, totalElements: items.length, totalPages: items.length ? 1 : 0 });
const metrics = (id: number, found = true, rootAfterSearch: number | null = id): SearchMetrics => ({
  resourceId: id,
  found,
  comparisons: 2,
  searchDepth: 1,
  rotations: 1,
  rootAfterSearch,
  searchedAt: '2026-10-10T09:10:00Z',
});

let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
function client() {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
}
function withClient(element: React.ReactNode) {
  const queryClient = client();
  queryClient.setQueryData(['attachments', 'policy'], { maxFileSizeBytes: 20 * 1024 * 1024, contentType: 'application/pdf', maxFilesPerRequest: 1 });
  return <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>;
}

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('real catalogue workflows', () => {
  it('searches resource metadata by name and selects the returned resource without showing its internal ID', async () => {
    const resource = { ...sampleResource(1002, 'Database Systems — Lab Manual'), resourceUrl: 'https://example.edu/lab-manual.pdf', resourceReference: 'catalogue-key-1002' };
    fetchMock.mockResolvedValue(jsonResponse(pageOf([resource])));
    const onSelect = vi.fn();
    const user = userEvent.setup();

    render(withClient(<ResourceSearch onSelect={onSelect} />));
    await user.type(screen.getByRole('searchbox', { name: /title, subject, description or tags/i }), 'database');
    const result = await screen.findByRole('button', { name: /database systems/i });
    expect(result).toHaveTextContent('Subject: Computer Science');
    expect(result).toHaveTextContent('Term: Year 2 · Semester 1');
    expect(result).toHaveTextContent('Description: An illustrative resource for UI tests.');
    expect(result).toHaveTextContent('Tags: dsa, lecture');
    expect(result).toHaveTextContent('URL: https://example.edu/lab-manual.pdf');
    expect(result).toHaveTextContent('Reference: catalogue-key-1002');
    expect(screen.queryByText('1002')).not.toBeInTheDocument();

    await user.click(result);
    expect(onSelect).toHaveBeenCalledWith(resource);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/resources/search?q=database&limit=50');
  });

  it('shows an empty search result after retrying a temporary API error', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ code: 'SEARCH_UNAVAILABLE', message: 'Search is temporarily unavailable.', details: {}, timestamp: '2026-10-10T09:10:00Z', searchMetrics: null }, 503))
      .mockResolvedValueOnce(jsonResponse(pageOf([])));
    const user = userEvent.setup();
    render(withClient(<ResourceSearch onSelect={vi.fn()} />));
    await user.type(screen.getByRole('searchbox', { name: /title, subject, description or tags/i }), 'missing resource');

    expect(await screen.findByRole('alert')).toHaveTextContent('Search is temporarily unavailable.');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText(/No resources found for “missing resource”/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('records one real ID lookup when a selected resource detail route opens and displays the backend metrics', async () => {
    const resource = sampleResource(1001, 'Introduction to Data Structures — Lecture Notes');
    const lookup = { resource, search: metrics(1001) };
    fetchMock.mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/resources/1001') return jsonResponse(lookup);
      if (path === '/api/resources/1001/attachments') return jsonResponse([]);
      throw new Error(`Unexpected request: ${path}`);
    });

    render(withClient(<MemoryRouter initialEntries={['/resources/1001']}><Routes><Route path="/resources/:id" element={<ResourceDetailPage />} /></Routes></MemoryRouter>));
    expect(await screen.findByRole('heading', { name: resource.title })).toBeInTheDocument();
    expect(screen.getByText('Splay Tree search metrics')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.filter(([input]) => String(input) === '/api/resources/1001')).toHaveLength(1));
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === '/api/resources/1001/attachments')).toHaveLength(1);
  });

  it('creates a resource with a programmatically assigned ID and no manual-ID field', async () => {
    const created = sampleResource(1008, 'Operating Systems — Reference Notes');
    let createBody: Record<string, unknown> | undefined;
    fetchMock.mockImplementation(async (input, init) => {
      const path = String(input);
      if (path.startsWith('/api/resources?')) return jsonResponse(pageOf([sampleResource(1007, 'Highest ID')], 1));
      if (path === '/api/resources' && init?.method === 'POST') {
        createBody = JSON.parse(String(init.body)) as Record<string, unknown>;
        return jsonResponse(created, 201);
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();

    function NoticeRoute() {
      const location = useLocation();
      return <p role="status">{(location.state as { notice?: string } | null)?.notice}</p>;
    }

    render(withClient(
      <MemoryRouter initialEntries={['/resources/new']}>
        <Routes>
          <Route path="/resources/new" element={<ResourceFormPage />} />
          <Route path="/resources" element={<NoticeRoute />} />
        </Routes>
      </MemoryRouter>,
    ));

    expect(screen.queryByLabelText(/resource id/i)).not.toBeInTheDocument();
    await user.type(screen.getByLabelText(/title/i), 'Operating Systems — Reference Notes');
    await user.type(screen.getByLabelText(/^category/i), 'Reference Materials');
    await user.type(screen.getByLabelText(/resource type/i), 'Notes');
    await user.type(screen.getByLabelText(/subject/i), 'Computer Science');
    await user.type(screen.getByLabelText(/^tags/i), 'operating-systems, reference');
    await user.click(screen.getByRole('button', { name: /add resource/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Resource added to the catalogue.');
    expect(createBody).toMatchObject({ id: 1008, title: 'Operating Systems — Reference Notes', category: 'Reference Materials', resourceType: 'Notes' });
    expect(fetchMock.mock.calls.some(([input]) => String(input) === '/api/resources/1008')).toBe(false);
  });

  it('uses the server snapshot and refreshes the real Splay Tree after name selection opens a resource', async () => {
    const resource = sampleResource(1002, 'Database Systems — Lab Manual');
    let opened = false;
    let snapshotCalls = 0;
    const initialTree: TreeSnapshot = {
      size: 2, height: 2, rootId: 1001, lastAccessedResourceId: 1001, latestSearch: metrics(1001),
      nodes: [
        { id: 1001, parentId: null, leftId: null, rightId: 1002, depth: 0 },
        { id: 1002, parentId: 1001, leftId: null, rightId: null, depth: 1 },
      ],
    };
    const updatedTree: TreeSnapshot = {
      ...initialTree,
      rootId: 1002,
      lastAccessedResourceId: 1002,
      nodes: [
        { id: 1002, parentId: null, leftId: 1001, rightId: null, depth: 0 },
        { id: 1001, parentId: 1002, leftId: null, rightId: null, depth: 1 },
      ],
    };
    fetchMock.mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/dsa/splay-tree') {
        snapshotCalls += 1;
        return jsonResponse(opened ? updatedTree : initialTree);
      }
      if (path === '/api/dsa/splay-tree/metrics') return jsonResponse({ rootId: opened ? 1002 : 1001, size: 2, height: 2, latestSearch: metrics(opened ? 1002 : 1001) });
      if (path.startsWith('/api/resources/search?')) return jsonResponse(pageOf([resource]));
      if (path === '/api/resources/1002') {
        opened = true;
        return jsonResponse({ resource, search: metrics(1002, true, 1002) });
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();

    render(withClient(<MemoryRouter initialEntries={['/dsa']}><Routes><Route path="/dsa" element={<SplayTreePage />} /></Routes></MemoryRouter>));
    await screen.findByText('Live tree state');
    await user.type(screen.getByRole('searchbox', { name: /title, subject, description or tags/i }), 'database');
    await user.click(await screen.findByRole('button', { name: /database systems/i }));
    expect(await screen.findByText(/access recorded: database systems/i)).toBeInTheDocument();
    await waitFor(() => expect(snapshotCalls).toBeGreaterThan(1));
    expect(String(fetchMock.mock.calls.find(([input]) => String(input) === '/api/resources/1002')?.[0])).toBe('/api/resources/1002');
    expect(screen.getByText('Root ID').parentElement).toHaveTextContent('1002');
    expect(screen.getByRole('img', { name: /Splay Tree with 2 resource nodes/i })).toBeInTheDocument();
  });

  it('refreshes the real tree snapshot and metrics after a failed manual demonstration lookup', async () => {
    const failedMetrics = metrics(9999, false, 1002);
    const initialTree: TreeSnapshot = {
      size: 2,
      height: 2,
      rootId: 1001,
      lastAccessedResourceId: 1001,
      latestSearch: metrics(1001),
      nodes: [
        { id: 1001, parentId: null, leftId: null, rightId: 1002, depth: 0 },
        { id: 1002, parentId: 1001, leftId: null, rightId: null, depth: 1 },
      ],
    };
    const updatedTree: TreeSnapshot = {
      ...initialTree,
      rootId: 1002,
      latestSearch: failedMetrics,
      nodes: [
        { id: 1002, parentId: null, leftId: 1001, rightId: null, depth: 0 },
        { id: 1001, parentId: 1002, leftId: null, rightId: null, depth: 1 },
      ],
    };
    const errorPayload = {
      code: 'RESOURCE_NOT_FOUND',
      message: 'Resource 9999 was not found.',
      details: {},
      timestamp: '2026-10-10T09:10:00Z',
      searchMetrics: failedMetrics,
    };
    let snapshotCalls = 0;
    let metricsCalls = 0;
    fetchMock.mockImplementation(async (input) => {
      const path = String(input);
      if (path === '/api/dsa/splay-tree') {
        snapshotCalls += 1;
        return jsonResponse(snapshotCalls === 1 ? initialTree : updatedTree);
      }
      if (path === '/api/dsa/splay-tree/metrics') {
        metricsCalls += 1;
        return jsonResponse({ rootId: snapshotCalls === 1 ? 1001 : 1002, size: 2, height: 2, latestSearch: snapshotCalls === 1 ? metrics(1001) : failedMetrics });
      }
      if (path === '/api/resources/9999') return jsonResponse(errorPayload, 404);
      throw new Error(`Unexpected request: ${path}`);
    });
    const user = userEvent.setup();

    render(withClient(<MemoryRouter initialEntries={['/dsa']}><Routes><Route path="/dsa" element={<SplayTreePage />} /></Routes></MemoryRouter>));
    await screen.findByText('Live tree state');
    await waitFor(() => expect(screen.getByText('Root ID').parentElement).toHaveTextContent('1001'));
    await user.click(screen.getByText('Optional: DSA Demonstration'));
    await user.type(screen.getByLabelText('Resource ID'), '9999');
    await user.click(screen.getByRole('button', { name: 'Access resource ID' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The requested resource was not found (HTTP 404).');
    expect(screen.getByRole('alert')).toHaveTextContent('root after search: 1002');
    await waitFor(() => expect(screen.getByText('Root ID').parentElement).toHaveTextContent('1002'));
    expect(snapshotCalls).toBeGreaterThan(1);
    expect(metricsCalls).toBeGreaterThan(1);
    expect(screen.queryByText(/Access recorded:/i)).not.toBeInTheDocument();
  });

  it('renders actual benchmark values and keeps time and comparison units separate', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      available: true,
      reportName: 'benchmark-results.csv',
      message: 'Source: supplied benchmark CSV.',
      rows: [
        { workload: 'Random searches', tree: 'Ordinary BST', resourceCount: 1000, searchCount: 2500, heightAfterMetrics: 18, avgComparisons: 12.6, avgDepth: 11.6, avgRotationsPerSearch: 0, medianSearchTimeMs: 0.04 },
        { workload: 'Random searches', tree: 'AVL Tree', resourceCount: 1000, searchCount: 2500, heightAfterMetrics: 12, avgComparisons: 9.2, avgDepth: 8.2, avgRotationsPerSearch: 0, medianSearchTimeMs: 0.03 },
        { workload: 'Random searches', tree: 'Splay Tree', resourceCount: 1000, searchCount: 2500, heightAfterMetrics: 18, avgComparisons: 15.1, avgDepth: 14.1, avgRotationsPerSearch: 12.3, medianSearchTimeMs: 0.05 },
      ],
    }));
    render(withClient(<MemoryRouter><BenchmarkAnalyticsPage /></MemoryRouter>));
    expect(await screen.findByText('Exact benchmark measurements')).toBeInTheDocument();
    expect(screen.getByText('Median search time (ms)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Average comparisons' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('15.1');
    expect(screen.getByRole('table')).toHaveTextContent('0.05');
    expect(screen.getByText(/5,000 of 10,000 lookups target key 500/i)).toBeInTheDocument();
    expect(screen.getByText(/70% of requests target IDs 1–100/i)).toBeInTheDocument();
    expect(screen.getByText(/probability proportional to 1\/rank/i)).toBeInTheDocument();
    expect(screen.getByText(/AVL may outperform Splay/i)).toBeInTheDocument();
  });

  it('explains an unavailable benchmark report without rendering fabricated measurements', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ available: false, reportName: 'benchmark-results.csv', message: 'The validated benchmark report is unavailable.', rows: [] }));
    render(withClient(<MemoryRouter><BenchmarkAnalyticsPage /></MemoryRouter>));
    expect(await screen.findByRole('heading', { name: 'Benchmark report unavailable' })).toBeInTheDocument();
    expect(screen.getByText('The validated benchmark report is unavailable.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
