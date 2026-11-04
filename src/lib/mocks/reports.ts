import type {
  AnalyticsResult,
  MetricBinding,
  PublishedDataPreview,
  ReportWidget,
  WorkspaceState,
} from '@/lib/flows/types';

type Locale = 'en' | 'fa';
const flowId = 'mock-sales-orders';
const loadId = 'mock-sales-snapshot';
const timestamp = '2026-06-30T12:00:00.000Z';
const names = {
  en: {
    dataset: 'Fictional sales orders',
    report: 'Sample · Sales overview',
    detail: 'Sample · Regional performance',
    regions: ['North', 'South', 'East', 'West'],
    categories: ['Software', 'Services', 'Hardware'],
    monthly: 'Sample · Monthly sales',
    regional: 'Sample · Sales by region',
    category: 'Sample · Sales by category',
    table: 'Sample · Regional totals',
  },
  fa: {
    dataset: 'سفارش‌های فروش فرضی',
    report: 'نمونه · نمای کلی فروش',
    detail: 'نمونه · عملکرد منطقه‌ای',
    regions: ['شمال', 'جنوب', 'شرق', 'غرب'],
    categories: ['نرم‌افزار', 'خدمات', 'سخت‌افزار'],
    monthly: 'نمونه · فروش ماهانه',
    regional: 'نمونه · فروش منطقه‌ای',
    category: 'نمونه · فروش بر اساس دسته',
    table: 'نمونه · مجموع منطقه‌ای',
  },
};

/** Deterministic fictional orders. No real customer, account, or connector data. */
const orders = (locale: Locale) =>
  Array.from({ length: 72 }, (_, index) => {
    const month = Math.floor(index / 12) + 1;
    const region = index % 4;
    const category = Math.floor(index / 4) % 3;
    return {
      order_id: `SAMPLE-${String(index + 1).padStart(3, '0')}`,
      customer_id: `DEMO-${String((index % 18) + 1).padStart(2, '0')}`,
      order_date: `2026-${String(month).padStart(2, '0')}-15`,
      month: `2026-${String(month).padStart(2, '0')}`,
      region: names[locale].regions[region],
      category: names[locale].categories[category],
      amount: (
        (12000 + month * 1700 + region * 2300 + category * 3100 + (index % 7) * 125) /
        100
      ).toFixed(2),
    };
  });
const columns = ['order_id', 'customer_id', 'order_date', 'month', 'region', 'category', 'amount'];

export const createReportsWorkspace = (locale: Locale): WorkspaceState => {
  const copy = names[locale];
  const bindingSeeds: [MetricBinding['metricId'], Record<string, string>][] = [
    ['record_count', {}],
    ['customer_count', { customer_id: 'customer_id' }],
    ['order_count', { order_id: 'order_id' }],
    ['sales_amount', { amount: 'amount' }],
    ['average_order_value', { amount: 'amount', order_id: 'order_id' }],
  ];
  const bindings: MetricBinding[] = bindingSeeds.map(([metricId, fields]) => ({
    id: `mock-${metricId}`,
    metricId,
    flowId,
    fields,
    currency: ['sales_amount', 'average_order_value'].includes(metricId) ? 'USD' : '',
    definition:
      locale === 'fa'
        ? 'تعریف نمایشی بر اساس سفارش‌های کاملاً فرضی؛ تأیید و اعتبارسنجی واقعی انجام نشده است.'
        : 'Demonstration definition based on fictional orders. Approval and validation fields are simulated.',
    ownerId: 'mock-owner',
    approvedBy: 'mock-reviewer',
    approvedAt: timestamp,
    validatedLoadId: loadId,
    validatedAt: timestamp,
  }));
  const widget = (
    id: string,
    title: string,
    kind: ReportWidget['kind'],
    dimension: string,
    measure = 'amount',
    aggregation: ReportWidget['aggregation'] = 'sum',
    bindingId?: string,
  ): ReportWidget => ({
    id: `mock-widget-${id}`,
    title,
    kind,
    dimension,
    measure,
    aggregation,
    flowId,
    ...(bindingId ? { bindingId } : {}),
  });
  const overview = [
    widget('sales', 'sales_amount', 'kpi', '', 'amount', 'sum', 'mock-sales_amount'),
    widget('orders', 'order_count', 'kpi', '', 'order_id', 'count', 'mock-order_count'),
    widget(
      'average',
      'average_order_value',
      'kpi',
      '',
      'amount',
      'avg',
      'mock-average_order_value',
    ),
    widget('monthly', copy.monthly, 'line', 'month'),
    widget('regional', copy.regional, 'bar', 'region'),
    widget('category', copy.category, 'pie', 'category'),
  ];
  const regional = [
    widget('customers', 'customer_count', 'kpi', '', 'customer_id', 'count', 'mock-customer_count'),
    widget('regional-detail', copy.regional, 'bar', 'region'),
    widget('table', copy.table, 'table', 'region'),
  ];
  return {
    connections: [],
    runs: [],
    bindings,
    flows: [
      {
        id: flowId,
        name: copy.dataset,
        kind: 'csv',
        sampleData: true,
        columns: columns.map((column) => ({
          source: column,
          target: column,
          required: true,
          type: column === 'amount' ? 'Decimal(18,2)' : column === 'order_date' ? 'Date' : 'String',
        })),
        primaryKey: 'order_id',
        grain: locale === 'fa' ? 'یک سفارش فرضی در هر ردیف' : 'One fictional order per row',
        status: 'published',
        activeLoadId: loadId,
        rowCount: 72,
        createdAt: timestamp,
        publishedAt: timestamp,
      },
    ],
    reports: [
      {
        id: 'mock-sales-overview',
        name: copy.report,
        widgets: overview,
        publishedWidgets: overview,
        updatedAt: timestamp,
        publishedAt: timestamp,
        publishedRevision: 1,
      },
      {
        id: 'mock-regional-performance',
        name: copy.detail,
        widgets: regional,
        publishedWidgets: regional,
        updatedAt: timestamp,
        publishedAt: timestamp,
        publishedRevision: 1,
      },
    ],
  };
};

export const queryReportsWidget = (widget: ReportWidget, locale: Locale): AnalyticsResult => {
  if (widget.flowId !== flowId) throw new Error('backendUnavailable');
  let data = orders(locale);
  if (widget.filterField && widget.filterValue !== undefined) {
    if (!columns.includes(widget.filterField)) throw new Error('backendUnavailable');
    data = data.filter(
      (row) => String(row[widget.filterField as keyof typeof row]) === widget.filterValue,
    );
  }
  if (widget.dateField) {
    if (widget.dateField !== 'order_date' && widget.dateField !== 'month')
      throw new Error('backendUnavailable');
    data = data.filter(
      (row) =>
        (!widget.dateFrom || row.order_date >= widget.dateFrom) &&
        (!widget.dateTo || row.order_date <= widget.dateTo),
    );
  }
  if (widget.dimension && !columns.includes(widget.dimension))
    throw new Error('backendUnavailable');
  const metric = widget.bindingId?.replace(/^mock-/, '');
  if (
    metric &&
    ![
      'record_count',
      'customer_count',
      'order_count',
      'sales_amount',
      'average_order_value',
    ].includes(metric)
  )
    throw new Error('backendUnavailable');
  const aggregation =
    metric === 'sales_amount'
      ? 'sum'
      : metric === 'average_order_value'
        ? 'avg'
        : metric
          ? 'count'
          : widget.aggregation;
  if (!metric && aggregation !== 'count' && widget.measure !== 'amount')
    throw new Error('backendUnavailable');
  const groups = new Map<string, ReturnType<typeof orders>>();
  for (const row of data) {
    const label =
      widget.kind === 'kpi' || !widget.dimension
        ? 'Total'
        : String(row[widget.dimension as keyof typeof row]);
    const group = groups.get(label) ?? [];
    group.push(row);
    groups.set(label, group);
  }
  const rows = [...groups].map(([label, group]) => {
    const cents = group.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
    const value =
      metric === 'customer_count'
        ? new Set(group.map((row) => row.customer_id)).size
        : metric === 'order_count'
          ? new Set(group.map((row) => row.order_id)).size
          : aggregation === 'count'
            ? group.length
            : (cents / (aggregation === 'avg' ? group.length : 1) / 100).toFixed(2);
    return { label, value };
  });
  return { rows: rows.slice(0, 500), queriedAt: timestamp, publishedAt: timestamp, limit: 500 };
};

export const previewReportsData = (
  requestedFlowId: string,
  requestedLoadId: string,
  page: number,
  locale: Locale,
): PublishedDataPreview => {
  if (
    requestedFlowId !== flowId ||
    requestedLoadId !== loadId ||
    !Number.isInteger(page) ||
    page < 0
  )
    throw new Error('backendUnavailable');
  const data = orders(locale);
  const pageSize = 20;
  return {
    columns,
    rows: data.slice(page * pageSize, (page + 1) * pageSize),
    page,
    pageSize,
    hasMore: (page + 1) * pageSize < data.length,
    loadId,
    publishedAt: timestamp,
    queriedAt: timestamp,
  };
};
