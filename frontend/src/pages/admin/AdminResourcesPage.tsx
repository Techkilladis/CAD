import { useState } from 'react';
import { Link } from 'react-router-dom';
import { getResourceMatrix } from '../../api/dashboard';
import type { ResourceMatrixCell, ResourceType } from '../../api/types';
import { useLoad } from '../../hooks/useLoad';
import { Card, CardBody, CardHeader, ErrorState, KpiCard, PageLoader, RefreshBar, StatusBadge } from '../../components/ui';
import { PageHeader } from '../../components/PageHeader';
import { UpdateModal } from '../../features/ResourceTable';
import { RESOURCE_LABEL } from '../../lib/format';
import { RESOURCE_TYPES } from '../../api/types';

export function AdminResourcesPage() {
  const { data, loading, error, reload, loadedAt } = useLoad(() => getResourceMatrix(), []);
  const [editing, setEditing] = useState<{ cell: ResourceMatrixCell; type: ResourceType } | null>(null);

  const cellFor = (shelterId: string, type: ResourceType) => data?.types.find((t) => t.resourceType === type)?.shelters.find((c) => c.shelterId === shelterId);

  return (
    <div>
      <PageHeader title="Resources" subtitle="District-wide stock by shelter. Click a cell to update it." actions={<RefreshBar asOf={data?.asOf ?? loadedAt} onRefresh={reload} loading={loading} />} />
      {loading && !data && <PageLoader />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {data.types.map((t) => (
              <KpiCard
                key={t.resourceType}
                label={`${RESOURCE_LABEL[t.resourceType]} (district)`}
                value={`${t.total.toLocaleString('en-IN')} ${t.unit ?? ''}`}
                hint={`${t.lowCount} low · ${t.criticalCount} critical · ${t.emptyCount} empty`}
                tone={t.criticalCount + t.emptyCount > 0 ? 'red' : t.lowCount > 0 ? 'amber' : 'green'}
              />
            ))}
          </div>

          <Card>
            <CardHeader title="Stock matrix" subtitle="Inactive shelters are excluded" />
            <CardBody className="!p-0 overflow-x-auto">
              <table className="min-w-full text-sm divide-y divide-gray-200">
                <thead className="bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Shelter</th>
                    {RESOURCE_TYPES.map((t) => (
                      <th key={t} className="px-4 py-2.5 text-left">
                        {RESOURCE_LABEL[t]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.shelters.map((s) => (
                    <tr key={s.id}>
                      <td className="px-4 py-3 font-medium">
                        <Link to={`/admin/shelters/${s.id}?tab=resources`} className="hover:text-blue-600">
                          {s.name}
                        </Link>
                      </td>
                      {RESOURCE_TYPES.map((t) => {
                        const c = cellFor(s.id, t);
                        return (
                          <td key={t} className="px-4 py-3">
                            {c ? (
                              <button
                                onClick={() => setEditing({ cell: c, type: t })}
                                className="text-left rounded-lg px-2 py-1 hover:bg-gray-100 w-full"
                                aria-label={`Update ${RESOURCE_LABEL[t]} at ${s.name}`}
                              >
                                <span className="block font-semibold text-gray-900">
                                  {c.quantity.toLocaleString('en-IN')} <span className="text-xs font-normal text-gray-500">{c.unit}</span>
                                </span>
                                <StatusBadge status={c.stockStatus} />
                              </button>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        </div>
      )}
      <UpdateModal
        shelterId={editing?.cell.shelterId ?? ''}
        resource={editing ? { id: editing.cell.resourceId, resourceType: editing.type, quantity: editing.cell.quantity, unit: editing.cell.unit, lowStockThreshold: editing.cell.lowStockThreshold } : null}
        onClose={() => setEditing(null)}
        onSaved={() => void reload()}
      />
    </div>
  );
}
