import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslations } from 'use-intl';

import { toDashboardWidget } from '@/features/dashboards/lib/server-sheets';
import { WidgetEditorActions } from '@/features/dashboards/molecules/WidgetEditorActions';
import { createKpiSheetWidget, getKpiAvailableTables } from '@/features/kpis/api/kpi-api';
import {
  isValidChart,
  newChart,
  toKpiQuery,
  type ChartDraft,
} from '@/features/kpis/lib/chart-draft';
import { KpiChartEditor } from '@/features/kpis/organisms/KpiChartEditor';
import { Button } from '@/shared/ui/atoms/button/button';

import type { DashboardWidget } from '@/features/dashboards/lib/dashboard';

export const KpiWidgetEditor = ({
  widget,
  sheetId,
  onApply,
  onCancel,
}: {
  widget: DashboardWidget;
  sheetId: number;
  onApply: (widget: DashboardWidget) => void;
  onCancel: () => void;
}) => {
  const t = useTranslations('kpis');
  const a = useTranslations('analytics');
  const [chart, setChart] = useState<ChartDraft>(() => ({
    ...newChart(),
    ...widget.kpiQuery,
    title: widget.title,
    chart_type:
      widget.visual === 'card'
        ? 'number'
        : ['bar', 'line', 'pie', 'table'].includes(widget.visual)
          ? (widget.visual as ChartDraft['chart_type'])
          : 'bar',
    filters: (widget.kpiQuery?.filters ?? []).map((filter) => ({
      ...filter,
      id: crypto.randomUUID(),
      value: Array.isArray(filter.value) ? filter.value.join(',') : String(filter.value ?? ''),
    })),
  }));
  const tables = useQuery({
    queryKey: ['kpi-tables'],
    queryFn: ({ signal }) => getKpiAvailableTables(signal),
    retry: false,
  });
  const create = useMutation({
    mutationFn: () =>
      createKpiSheetWidget(sheetId, {
        ...toKpiQuery(chart),
        title: chart.title.trim(),
        chart_type: chart.chart_type,
      }),
    retry: false,
    onSuccess: (created) => onApply(toDashboardWidget(created)),
  });
  return (
    <form
      className="analytics-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (!tables.isSuccess || !tables.data.length || !isValidChart(chart)) return;
        if (!create.isPending) create.mutate();
      }}
    >
      <fieldset disabled={create.isPending} className="bi-widget-drawer-content">
        {tables.isPending ? (
          <p role="status">{t('loadingTables')}</p>
        ) : tables.isError ? (
          <div role="alert">
            <p>{tables.error.message}</p>
            <Button type="button" onClick={() => void tables.refetch()}>
              {a('retry')}
            </Button>
          </div>
        ) : !tables.data.length ? (
          <p role="status">{t('noTables')}</p>
        ) : (
          <KpiChartEditor embedded chart={chart} tables={tables.data} onChange={setChart} />
        )}
      </fieldset>
      {create.isError && <p role="alert">{create.error.message}</p>}
      <WidgetEditorActions
        onCancel={onCancel}
        pending={create.isPending}
        disabled={
          create.isPending || !tables.isSuccess || !tables.data.length || !isValidChart(chart)
        }
      />
    </form>
  );
};
