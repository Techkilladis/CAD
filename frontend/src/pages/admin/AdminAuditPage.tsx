import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getAudit, getAuditFacets, listUsers } from '../../api/admin';
import type { AuditRow } from '../../api/types';
import { useLoad } from '../../hooks/useLoad';
import { Button, Card, DataTable, ErrorState, PageLoader, RefreshBar, Select, type Column } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { fmtDateTime } from '../../lib/format';

export function AdminAuditPage() {
  const [entity, setEntity] = useState('');
  const [userId, setUserId] = useState('');
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const facets = useLoad(getAuditFacets, []);
  const users = useLoad(listUsers, []);
  const { data, loading, error, reload, loadedAt } = useLoad(
    () => getAudit({ entity: entity || undefined, userId: userId || undefined, action: action || undefined, page, pageSize: 25 }),
    [entity, userId, action, page]
  );
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setPage(1);
  };

  const columns: Column<AuditRow>[] = [
    { key: 'time', header: 'When', render: (r) => <span className="text-xs whitespace-nowrap">{fmtDateTime(r.timestamp)}</span> },
    { key: 'user', header: 'User', render: (r) => (r.user ? <span>{r.user.name} <span className="text-xs text-gray-400">({r.user.role.toLowerCase()})</span></span> : <span className="text-gray-400">public / system</span>) },
    { key: 'action', header: 'Action', render: (r) => <code className="text-xs bg-gray-100 rounded px-1.5 py-0.5">{r.action}</code> },
    { key: 'entity', header: 'Entity', render: (r) => <span className="text-xs">{r.entity} <span className="text-gray-400">{r.entityId.slice(0, 8)}</span></span> },
    { key: 'meta', header: 'Details', render: (r) => <span className="text-xs text-gray-600 break-all line-clamp-2">{r.metadata ? JSON.stringify(r.metadata) : '—'}</span> },
  ];

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Every important change, who made it and when." actions={<RefreshBar asOf={loadedAt} onRefresh={reload} loading={loading} />} />
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="w-48"><Select label="Entity" value={entity} onChange={(e) => reset(setEntity)(e.target.value)}><option value="">All</option>{facets.data?.entities.map((x) => (<option key={x} value={x}>{x}</option>))}</Select></div>
        <div className="w-56"><Select label="Action" value={action} onChange={(e) => reset(setAction)(e.target.value)}><option value="">All</option>{facets.data?.actions.map((x) => (<option key={x} value={x}>{x}</option>))}</Select></div>
        <div className="w-56"><Select label="User" value={userId} onChange={(e) => reset(setUserId)(e.target.value)}><option value="">Anyone</option>{users.data?.map((u) => (<option key={u.id} value={u.id}>{u.name}</option>))}</Select></div>
      </div>
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <Card>
          <DataTable columns={columns} rows={data.items} rowKey={(r) => r.id} pageSize={25} emptyTitle="No audit entries match" />
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
            <span>{data.total.toLocaleString('en-IN')} entries · page {data.page} of {data.pages}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" disabled={data.page <= 1} onClick={() => setPage(page - 1)} icon={<ChevronLeft className="h-3.5 w-3.5" />}>Newer</Button>
              <Button size="sm" variant="secondary" disabled={data.page >= data.pages} onClick={() => setPage(page + 1)}>Older <ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
