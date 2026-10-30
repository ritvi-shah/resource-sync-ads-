import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AppShell from '../components/AppShell';
import DashboardPage from '../pages/DashboardPage';
import ResourceLibraryPage from '../pages/ResourceLibraryPage';
import ResourceFormPage from '../pages/ResourceFormPage';
import { PopularResourcesPage, RecentResourcesPage } from '../pages/CollectionPages';
import type { AnalyticsSummary, Resource, ResourcePage } from '../api/types';

function makeResource(id: number, title: string): Resource {
  return {
    id, title, description: 'A real catalogue description for this test record.',
    category: 'Lecture Notes', resourceType: 'PDF', subject: 'Computer Science',
    academicTerm: 'Year 2 · Semester 1', resourceUrl: null, resourceReference: null,
    tags: ['data-structures'], createdAt: '2026-10-01T12:00:00Z', updatedAt: '2026-10-01T12:00:00Z',
    sample: true, accessCount: 3, lastAccessed: '2026-10-10T09:10:00Z',
  };
}
const pageOf = (items: Resource[], size = 10): ResourcePage => ({ items, page: 0, size, totalElements: items.length, totalPages: items.length ? 1 : 0 });
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
function withClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  queryClient.setQueryData(['attachments', 'policy'], { maxFileSizeBytes: 20 * 1024 * 1024, contentType: 'application/pdf', maxFilesPerRequest: 1 });
  return <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>;
}
function parse(input: RequestInfo | URL) {
  return new URL(String(input), 'http://campus.test');
}

beforeEach(() => {
  fetchMock = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('dashboard and catalogue pages', () => {
  it('renders current summary and named popular/recent dashboard shortcuts from the API', async () => {
    const resource = makeResource(1201, 'Algorithms — Lecture Notes');
    const summary: AnalyticsSummary = {
      resourceCount: 7, categoryCount: 5, totalAccesses: 12, treeSize: 7, treeHeight: 4,
      popularResources: [{ rank: 1, resource }],
      recentResources: [{ resource, accessedAt: '2026-10-10T09:10:00Z' }],
    };
    fetchMock.mockResolvedValue(response(summary));
    render(withClient(<MemoryRouter><DashboardPage /></MemoryRouter>));
    expect(await screen.findByText('12', { selector: 'strong' })).toBeInTheDocument();
    const resourceLinks = screen.getAllByRole('link', { name: /algorithms — lecture notes/i });
    expect(resourceLinks).toHaveLength(2);
    expect(resourceLinks.map((link) => link.getAttribute('href'))).toEqual(['/resources/1201', '/resources/1201']);
    expect(screen.getByText('Distinct resources from the bounded recent history.')).toBeInTheDocument();
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/analytics/summary');
  });

  it('filters by catalogue metadata and confirms deletion before calling the API', async () => {
    const resource = makeResource(1301, 'Database Systems — Lab Manual');
    let deleted = false;
    fetchMock.mockImplementation(async (input, init) => {
      const url = parse(input);
      if (url.pathname === '/api/resources/1301' && init?.method === 'DELETE') {
        deleted = true;
        return new Response(null, { status: 204 });
      }
      if (url.pathname === '/api/resources' && !init?.method) return response(pageOf(deleted ? [] : [resource]));
      throw new Error(`Unexpected request: ${url.pathname}${url.search}`);
    });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const user = userEvent.setup();
    render(withClient(<MemoryRouter initialEntries={['/resources']}><Routes><Route path="/resources" element={<ResourceLibraryPage />} /></Routes></MemoryRouter>));
    expect(await screen.findByRole('link', { name: resource.title })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/search catalogue/i), 'database');
    await user.type(screen.getByLabelText('Category'), 'Lecture Notes');
    await user.click(screen.getByRole('button', { name: /apply/i }));
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => {
      const url = parse(input);
      return url.pathname === '/api/resources' && url.searchParams.get('q') === 'database' && url.searchParams.get('category') === 'Lecture Notes';
    })).toBe(true));

    await user.click(screen.getByRole('button', { name: `Delete ${resource.title}` }));
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining(resource.title));
    expect(await screen.findByRole('status')).toHaveTextContent('Resource deleted from the catalogue.');
    expect(fetchMock.mock.calls.some(([input, init]) => String(input) === '/api/resources/1301' && init?.method === 'DELETE')).toBe(true);
    expect(fetchMock.mock.calls.some(([input, init]) => String(input) === '/api/resources/1301' && (!init?.method || init.method === 'GET'))).toBe(false);
  });

  it('requests the next server-backed catalogue page from the pagination controls', async () => {
    const resources = [makeResource(1601, 'Page One Notes'), makeResource(1602, 'Page Two Notes')];
    fetchMock.mockImplementation(async (input) => {
      const url = parse(input);
      if (url.pathname !== '/api/resources') throw new Error(`Unexpected request: ${url.pathname}${url.search}`);
      const page = Number(url.searchParams.get('page') ?? '0');
      return response({ ...pageOf([resources[page]], 10), page, totalElements: 2, totalPages: 2 });
    });
    const user = userEvent.setup();
    render(withClient(<MemoryRouter initialEntries={['/resources']}><Routes><Route path="/resources" element={<ResourceLibraryPage />} /></Routes></MemoryRouter>));

    expect(await screen.findByRole('link', { name: 'Page One Notes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(await screen.findByRole('link', { name: 'Page Two Notes' })).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    await waitFor(() => expect(fetchMock.mock.calls.some(([input]) => parse(input).searchParams.get('page') === '1')).toBe(true));
  });

  it('loads direct edit metadata through the list API and saves without a counted ID lookup', async () => {
    let current = makeResource(1401, 'Networks — Lecture Notes');
    fetchMock.mockImplementation(async (input, init) => {
      const url = parse(input);
      if (url.pathname === '/api/resources/1401' && init?.method === 'PUT') {
        current = { ...current, ...(JSON.parse(String(init.body)) as Partial<Resource>), updatedAt: '2026-10-19T12:00:00Z' };
        return response(current);
      }
      if (url.pathname === '/api/resources' && !init?.method) return response(pageOf([current], 100));
      throw new Error(`Unexpected request: ${url.pathname}${url.search}`);
    });
    const user = userEvent.setup();
    render(withClient(
      <MemoryRouter initialEntries={['/resources/1401/edit']}>
        <Routes>
          <Route path="/resources/:id/edit" element={<ResourceFormPage />} />
          <Route path="/resources" element={<p>Saved to catalogue</p>} />
        </Routes>
      </MemoryRouter>,
    ));
    const titleField = await screen.findByLabelText(/title/i);
    expect(titleField).toHaveValue('Networks — Lecture Notes');
    expect(fetchMock.mock.calls.some(([input, init]) => String(input) === '/api/resources/1401' && (!init?.method || init.method === 'GET'))).toBe(false);
    await user.clear(titleField);
    await user.type(titleField, 'Updated Networks Notes');
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText('Saved to catalogue')).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([input, init]) => String(input) === '/api/resources/1401' && init?.method === 'PUT')).toBe(true);
    expect(fetchMock.mock.calls.some(([input, init]) => String(input) === '/api/resources/1401' && (!init?.method || init.method === 'GET'))).toBe(false);
  });

  it('shows backend validation details beside the field and preserves form values', async () => {
    fetchMock.mockImplementation(async (input, init) => {
      const url = parse(input);
      if (url.pathname === '/api/resources' && !init?.method) return response(pageOf([]));
      if (url.pathname === '/api/resources' && init?.method === 'POST') {
        return response({
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed.',
          details: { title: 'Use the catalog-approved title.' },
          timestamp: '2026-10-10T09:10:00Z',
          searchMetrics: null,
        }, 400);
      }
      throw new Error(`Unexpected request: ${url.pathname}${url.search}`);
    });
    const user = userEvent.setup();
    render(withClient(<MemoryRouter initialEntries={['/resources/new']}><Routes><Route path="/resources/new" element={<ResourceFormPage />} /></Routes></MemoryRouter>));
    const title = screen.getByLabelText(/^title/i);
    await user.type(title, 'Network Lab Notes');
    await user.type(screen.getByLabelText(/^category/i), 'Laboratory Manuals');
    await user.type(screen.getByLabelText(/resource type/i), 'Notes');
    await user.click(screen.getByRole('button', { name: /add resource/i }));

    expect(await screen.findByText('Use the catalog-approved title.')).toBeInTheDocument();
    expect(title).toHaveAttribute('aria-invalid', 'true');
    expect(title).toHaveValue('Network Lab Notes');
    expect(screen.getByRole('alert')).toHaveTextContent('Request validation failed.');
  });

  it('retries programmatically assigned IDs after a duplicate conflict and keeps the form open', async () => {
    const attemptedIds: number[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const url = parse(input);
      if (url.pathname === '/api/resources' && !init?.method) return response(pageOf([makeResource(1700, 'Current highest ID')], 1));
      if (url.pathname === '/api/resources' && init?.method === 'POST') {
        attemptedIds.push((JSON.parse(String(init.body)) as { id: number }).id);
        return response({ code: 'DUPLICATE_RESOURCE', message: 'Resource ID 1701 already exists.', details: {}, timestamp: '2026-10-10T09:10:00Z', searchMetrics: null }, 409);
      }
      throw new Error(`Unexpected request: ${url.pathname}${url.search}`);
    });
    const user = userEvent.setup();
    render(withClient(<MemoryRouter initialEntries={['/resources/new']}><Routes><Route path="/resources/new" element={<ResourceFormPage />} /></Routes></MemoryRouter>));
    await user.type(screen.getByLabelText(/^title/i), 'Conflict fixture');
    await user.type(screen.getByLabelText(/^category/i), 'Reference Materials');
    await user.type(screen.getByLabelText(/resource type/i), 'Notes');
    await user.click(screen.getByRole('button', { name: /add resource/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Resource ID 1701 already exists.');
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Conflict fixture');
    expect(attemptedIds).toEqual([1701, 1701, 1701]);
  });

  it('preserves entered values and shows a useful error when persistence returns 503', async () => {
    let createAttempts = 0;
    fetchMock.mockImplementation(async (input, init) => {
      const url = parse(input);
      if (url.pathname === '/api/resources' && !init?.method) return response(pageOf([], 1));
      if (url.pathname === '/api/resources' && init?.method === 'POST') {
        createAttempts += 1;
        return response({ code: 'PERSISTENCE_UNAVAILABLE', message: 'The catalogue database is temporarily unavailable.', details: {}, timestamp: '2026-10-10T09:10:00Z', searchMetrics: null }, 503);
      }
      throw new Error(`Unexpected request: ${url.pathname}${url.search}`);
    });
    const user = userEvent.setup();
    render(withClient(<MemoryRouter initialEntries={['/resources/new']}><Routes><Route path="/resources/new" element={<ResourceFormPage />} /></Routes></MemoryRouter>));
    await user.type(screen.getByLabelText(/^title/i), 'Persistence failure fixture');
    await user.type(screen.getByLabelText(/^category/i), 'Reference Materials');
    await user.type(screen.getByLabelText(/resource type/i), 'Notes');
    await user.click(screen.getByRole('button', { name: /add resource/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The catalogue database is temporarily unavailable.');
    expect(screen.getByLabelText(/^title/i)).toHaveValue('Persistence failure fixture');
    expect(createAttempts).toBe(1);
  });

  it('accepts the maximum backend-supported list of thirty 48-character tags', async () => {
    const tags = Array.from({ length: 30 }, (_, index) => `tag${String(index).padStart(2, '0')}${'x'.repeat(43)}`);
    let submittedTags: string[] = [];
    fetchMock.mockImplementation(async (input, init) => {
      const url = parse(input);
      if (url.pathname === '/api/resources' && !init?.method) return response(pageOf([], 1));
      if (url.pathname === '/api/resources' && init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as { title: string; category: string; resourceType: string; tags: string[] };
        submittedTags = body.tags;
        return response({ ...makeResource(1603, body.title), ...body, id: 1603 }, 201);
      }
      throw new Error(`Unexpected request: ${url.pathname}${url.search}`);
    });
    const user = userEvent.setup();
    render(withClient(<MemoryRouter initialEntries={['/resources/new']}><Routes><Route path="/resources/new" element={<ResourceFormPage />} /><Route path="/resources" element={<p role="status">Saved</p>} /></Routes></MemoryRouter>));
    await user.type(screen.getByLabelText(/^title/i), 'Maximum tags fixture');
    await user.type(screen.getByLabelText(/^category/i), 'Reference Materials');
    await user.type(screen.getByLabelText(/resource type/i), 'Notes');
    const tagsInput = screen.getByLabelText(/^tags/i);
    const tagText = tags.join(', ');
    expect(tagsInput).toHaveAttribute('maxLength', '1498');
    fireEvent.change(tagsInput, { target: { value: tagText } });
    expect(tagsInput).toHaveValue(tagText);
    await user.click(screen.getByRole('button', { name: /add resource/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Saved');
    expect(submittedTags).toHaveLength(30);
    expect(submittedTags.every((tag) => tag.length === 48)).toBe(true);
  });

  it('rejects non-HTTP(S) resource URLs before sending a create request', async () => {
    const user = userEvent.setup();
    render(withClient(<MemoryRouter initialEntries={['/resources/new']}><Routes><Route path="/resources/new" element={<ResourceFormPage />} /></Routes></MemoryRouter>));
    await user.type(screen.getByLabelText(/^title/i), 'Local path should be rejected');
    await user.type(screen.getByLabelText(/^category/i), 'Reference Materials');
    await user.type(screen.getByLabelText(/resource type/i), 'Notes');
    await user.type(screen.getByLabelText(/resource URL/i), 'file:///etc/passwd');
    await user.click(screen.getByRole('button', { name: /add resource/i }));

    expect(await screen.findByText('Enter an absolute HTTP or HTTPS URL.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows actual Popular and bounded Recent endpoint data with distinct semantics', async () => {
    const resource = { ...makeResource(1501, 'Discrete Mathematics — Assignment'), resourceUrl: 'https://example.edu/discrete-math.pdf', resourceReference: 'assignment-record-key' };
    fetchMock.mockImplementation(async (input) => {
      const url = parse(input);
      if (url.pathname === '/api/resources/popular') return response([{ rank: 1, resource }]);
      if (url.pathname === '/api/resources/recent') return response([{ resource, accessedAt: '2026-10-10T09:10:00Z' }]);
      throw new Error(`Unexpected request: ${url.pathname}${url.search}`);
    });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { unmount } = render(<QueryClientProvider client={queryClient}><MemoryRouter><PopularResourcesPage /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText('Recorded access ranking')).toBeInTheDocument();
    expect(screen.getByText(/counts represent successful resource opens—not distinct people/i)).toBeInTheDocument();
    expect(screen.getByRole('table')).toHaveTextContent('Term: Year 2 · Semester 1');
    expect(screen.getByRole('table')).toHaveTextContent('Tags: data-structures');
    expect(screen.getByRole('table')).toHaveTextContent('URL: https://example.edu/discrete-math.pdf');
    expect(screen.getByRole('table')).toHaveTextContent('Reference: assignment-record-key');
    expect(screen.queryByText('1501')).not.toBeInTheDocument();
    unmount();
    render(<QueryClientProvider client={queryClient}><MemoryRouter><RecentResourcesPage /></MemoryRouter></QueryClientProvider>);
    expect(await screen.findByText('Recently opened')).toBeInTheDocument();
    expect(screen.getByText(/up to 20 distinct resource IDs/i)).toBeInTheDocument();
    expect(screen.getByText(/URL: https:\/\/example\.edu\/discrete-math\.pdf/)).toBeInTheDocument();
  });

  it('opens and closes the responsive navigation with working route links', async () => {
    fetchMock.mockResolvedValue(response({ status: 'ok', service: 'smart-content-manager', phase: 1, checkedAt: '2026-10-10T09:10:00Z' }));
    const user = userEvent.setup();
    render(withClient(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<p>Dashboard route content</p>} />
            <Route path="dsa" element={<p>Splay route content</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    ));
    await screen.findByText('API connected');
    const menu = screen.getByRole('button', { name: 'Open navigation' });
    await user.click(menu);
    expect(menu).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('link', { name: 'Splay Tree' }));
    expect(await screen.findByText('Splay route content')).toBeInTheDocument();
    expect(menu).toHaveAttribute('aria-expanded', 'false');
  });
});
