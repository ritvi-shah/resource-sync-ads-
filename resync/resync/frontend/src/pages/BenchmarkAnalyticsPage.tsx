import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ApiClientError } from '../api/client';
import { useBenchmarkReport } from '../api/queries';
import type { BenchmarkRow, BenchmarkTreeName, BenchmarkWorkload } from '../api/types';

type ChartDatum = { workload: BenchmarkWorkload } & Partial<Record<BenchmarkTreeName, number>>;
type MetricKey = 'medianSearchTimeMs' | 'avgComparisons';

const workloadOrder: BenchmarkWorkload[] = [
  'Random searches',
  'Repeated hot-key searches',
  'Mixed campus access',
  'Zipf-like popularity',
];
const workloadTickLabels: Record<BenchmarkWorkload, string> = {
  'Random searches': 'Random',
  'Repeated hot-key searches': 'Hot key',
  'Mixed campus access': 'Mixed',
  'Zipf-like popularity': 'Zipf-like',
};
const treeOrder: BenchmarkTreeName[] = ['Ordinary BST', 'AVL Tree', 'Splay Tree'];
const treeColors: Record<BenchmarkTreeName, string> = {
  'Ordinary BST': '#8a969d',
  'AVL Tree': '#688ed1',
  'Splay Tree': '#2be0cd',
};
const workloadExplanations = [
  {
    title: 'Random searches',
    detail: '10,000 uniformly sampled lookups across the 1,000 benchmark IDs; each key is equally likely.',
  },
  {
    title: 'Repeated hot-key searches',
    detail: '5,000 of 10,000 lookups target key 500. The other half cycles through a shuffled set of the remaining IDs.',
  },
  {
    title: 'Mixed campus access',
    detail: 'A shuffled mix: 70% of requests target IDs 1–100, 20% IDs 101–400, and 10% IDs 401–1,000.',
  },
  {
    title: 'Zipf-like popularity',
    detail: '10,000 lookups sampled with probability proportional to 1/rank across 1,000 IDs, so higher-ranked keys recur more often.',
  },
];

function makeChartData(rows: BenchmarkRow[], metric: MetricKey): ChartDatum[] {
  const grouped = new Map<BenchmarkWorkload, ChartDatum>();
  for (const row of rows) {
    const datum = grouped.get(row.workload) ?? { workload: row.workload };
    datum[row.tree] = row[metric];
    grouped.set(row.workload, datum);
  }
  return [...grouped.values()].sort(
    (a, b) => workloadOrder.indexOf(a.workload) - workloadOrder.indexOf(b.workload),
  );
}

function displayError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return 'The benchmark report could not be loaded.';
}

export default function BenchmarkAnalyticsPage() {
  const { data: report, error, isError, isPending, isFetching, refetch } = useBenchmarkReport();
  const [selectedWorkload, setSelectedWorkload] = useState<'all' | BenchmarkWorkload>('all');

  const workloads = useMemo(() => {
    if (!report) return [];
    const present = new Set(report.rows.map((row) => row.workload));
    return workloadOrder.filter((workload) => present.has(workload));
  }, [report]);
  const rows = useMemo(
    () => (report?.available
      ? report.rows.filter((row) => selectedWorkload === 'all' || row.workload === selectedWorkload)
      : []),
    [report, selectedWorkload],
  );
  const timeData = useMemo(() => makeChartData(rows, 'medianSearchTimeMs'), [rows]);
  const comparisonData = useMemo(() => makeChartData(rows, 'avgComparisons'), [rows]);
  const retry = () => { void refetch(); };

  return (
    <div className="page-stack">
      <header className="page-header">
        <h1 className="page-title">Benchmark analytics</h1>
        <p className="page-description">
          Compare search-tree behavior across synthetic workloads. These benchmark results are separate from live campus access analytics.
        </p>
      </header>

      {isPending && (
        <section className="state-panel" role="status" aria-live="polite">
          <h2 className="panel-title">Loading benchmark report</h2>
          <p className="panel-subtitle">Fetching the available benchmark measurements.</p>
        </section>
      )}

      {isError && !report && (
        <section className="state-panel" role="alert">
          <h2 className="panel-title">Could not load benchmark data</h2>
          <p className="panel-subtitle">{displayError(error)}</p>
          <button className="button button-secondary" type="button" onClick={retry} disabled={isFetching}>
            {isFetching ? 'Retrying…' : 'Retry'}
          </button>
        </section>
      )}

      {report && !report.available && (
        <section className="state-panel" role="status">
          <h2 className="panel-title">Benchmark report unavailable</h2>
          <p className="panel-subtitle">{report.message || 'No benchmark report is currently available.'}</p>
        </section>
      )}

      {report?.available && (
        <>
          {isError && (
            <div className="notice-card" role="alert">
              <p>Refresh failed: {displayError(error)}. The previously loaded report is still shown.</p>
              <button className="button button-secondary" type="button" onClick={retry} disabled={isFetching}>
                {isFetching ? 'Retrying…' : 'Retry'}
              </button>
            </div>
          )}

          <div className="analytics-toolbar">
            <label className="form-control">
              <span>Workload</span>
              <select
                value={selectedWorkload}
                onChange={(event) => setSelectedWorkload(event.target.value as 'all' | BenchmarkWorkload)}
                aria-label="Filter benchmark results by workload"
              >
                <option value="all">All workloads</option>
                {workloads.map((workload) => <option key={workload} value={workload}>{workload}</option>)}
              </select>
            </label>
            {report.reportName && <p className="panel-subtitle">Report: {report.reportName}</p>}
          </div>

          <section className="panel benchmark-guide" aria-labelledby="benchmark-workloads-title">
            <div className="panel-head">
              <div>
                <h2 className="panel-title" id="benchmark-workloads-title">What the workloads represent</h2>
                <p className="panel-subtitle">These are synthetic 10,000-search patterns over the 1,000-key benchmark set, not live student activity.</p>
              </div>
            </div>
            <div className="benchmark-workload-grid">
              {workloadExplanations.map((workload) => (
                <article className="benchmark-workload-card" key={workload.title}>
                  <h3>{workload.title}</h3>
                  <p>{workload.detail}</p>
                </article>
              ))}
            </div>
            <p className="panel-subtitle benchmark-method-note">
              An ordinary BST can become unbalanced; AVL is height-balanced; a splay tree moves accessed nodes toward the root but does not guarantee the fastest lookup. Results depend on the access pattern, and AVL may outperform Splay. Median search time is in milliseconds. These measurements are separate from live access analytics.
            </p>
            {report.message && <p className="panel-subtitle">{report.message}</p>}
          </section>

          {rows.length === 0 ? (
            <section className="state-panel" role="status">
              <h2 className="panel-title">No measurements for this selection</h2>
              <p className="panel-subtitle">
                {report.rows.length === 0
                  ? 'The report is available, but it contains no benchmark rows.'
                  : 'Choose a workload with returned benchmark rows to see its measurements.'}
              </p>
            </section>
          ) : (
            <>
              <div className="chart-grid">
                <section className="panel">
                  <div className="panel-head">
                    <h2 className="panel-title">Median search time</h2>
                    <p className="panel-subtitle">Median duration per search, in milliseconds (ms)</p>
                  </div>
                  <div className="chart-frame" role="img" aria-label="Bar chart comparing median search time in milliseconds by workload and tree">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeData} margin={{ top: 12, right: 18, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="workload" tick={{ fontSize: 12 }} tickFormatter={(value) => workloadTickLabels[value as BenchmarkWorkload] ?? String(value)} interval={0} label={{ value: 'Workload', position: 'insideBottom', offset: -4 }} />
                        <YAxis
                          type="number"
                          label={{ value: 'Median search time (ms)', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip formatter={(value, name) => [value, `${name} · median search time (ms)`]} />
                        <Legend />
                        {treeOrder.map((tree) => (
                          <Bar key={tree} dataKey={tree} name={tree} fill={treeColors[tree]} isAnimationActive={false} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>

                <section className="panel">
                  <div className="panel-head">
                    <h2 className="panel-title">Average comparisons</h2>
                    <p className="panel-subtitle">Average number of node comparisons per search</p>
                  </div>
                  <div className="chart-frame" role="img" aria-label="Bar chart comparing average node comparisons per search by workload and tree">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={comparisonData} margin={{ top: 12, right: 18, left: 8, bottom: 8 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="workload" tick={{ fontSize: 12 }} tickFormatter={(value) => workloadTickLabels[value as BenchmarkWorkload] ?? String(value)} interval={0} label={{ value: 'Workload', position: 'insideBottom', offset: -4 }} />
                        <YAxis
                          type="number"
                          label={{ value: 'Average comparisons per search', angle: -90, position: 'insideLeft' }}
                        />
                        <Tooltip formatter={(value, name) => [value, `${name} · average comparisons per search`]} />
                        <Legend />
                        {treeOrder.map((tree) => (
                          <Bar key={tree} dataKey={tree} name={tree} fill={treeColors[tree]} isAnimationActive={false} />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              </div>

              <section className="panel">
                <div className="panel-head">
                  <h2 className="panel-title">Exact benchmark measurements</h2>
                  <p className="panel-subtitle">Values below are shown as returned; no measurements are estimated or rounded.</p>
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <caption className="sr-only">Exact returned measurements for each workload and tree combination</caption>
                    <thead>
                      <tr>
                        <th scope="col">Workload</th>
                        <th scope="col">Tree</th>
                        <th scope="col">Resources</th>
                        <th scope="col">Searches</th>
                        <th scope="col">Height after metrics</th>
                        <th scope="col">Average comparisons</th>
                        <th scope="col">Average depth</th>
                        <th scope="col">Average rotations / search</th>
                        <th scope="col">Median search time (ms)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={`${row.workload}-${row.tree}-${index}`}>
                          <th scope="row">{row.workload}</th>
                          <td>{row.tree}</td>
                          <td>{row.resourceCount}</td>
                          <td>{row.searchCount}</td>
                          <td>{row.heightAfterMetrics}</td>
                          <td>{row.avgComparisons}</td>
                          <td>{row.avgDepth}</td>
                          <td>{row.avgRotationsPerSearch}</td>
                          <td>{row.medianSearchTimeMs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
