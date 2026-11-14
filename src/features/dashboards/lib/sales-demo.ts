import { solarKey } from '@/shared/lib/solar-calendar';

import type { DashboardWidget } from '@/features/dashboards/lib/dashboard';
import type { Query } from '@cubejs-client/core';

export const demoMeasures = [
  'purchases',
  'income',
  'formalIncome',
  'informalIncome',
  'cashIncome',
  'creditIncome',
  'expenses',
  'incomeReturns',
  'expenseReturns',
  'latestExpenses',
  'latestPurchases',
] as const;
export const demoDimensions = ['day', 'month', 'year', 'incomeType', 'paymentTerms'] as const;
export type DemoMeasure = (typeof demoMeasures)[number];
export type DemoDimension = (typeof demoDimensions)[number];
// All records are synthetic. IRR amounts exclude tax; no source mappings are claimed.
export const demoPurchases = Array.from({ length: 18 }, (_, index) => ({
  id: `PUR-${index + 1}`,
  date: `2026-${String(Math.floor(index / 3) + 1).padStart(2, '0')}-12`,
  amount: (25 + index * 7) * 1_000_000,
  confirmed: index % 7 !== 0,
}));
export type IncomeType = 'formal' | 'informal';
export type PaymentTerms = 'cash' | 'credit';
export interface DemoIncomeAllocation {
  incomeType: IncomeType;
  paymentTerms: PaymentTerms;
  amount: number;
}
export const incomeMeasures = [
  'income',
  'formalIncome',
  'informalIncome',
  'cashIncome',
  'creditIncome',
  'incomeReturns',
] as const;
export const isIncomeMeasure = (measure: string) => incomeMeasures.some((key) => key === measure);
export const supportsDemoDimension = (measure: string, dimension: string) => {
  if (!dimension) return true;
  if (['latestExpenses', 'latestPurchases'].includes(measure)) return false;
  if (['day', 'month', 'year'].includes(dimension)) return true;
  if (dimension === 'incomeType' || dimension === 'paymentTerms') return isIncomeMeasure(measure);
  return false;
};

export const demoRecognition = Array.from({ length: 6 }, (_, index) => {
  const income = (240 + index * 55) * 1_000_000;
  // Illustrative allocations, not source mappings or recognition policy.
  const incomeAllocations: DemoIncomeAllocation[] = [
    { incomeType: 'formal', paymentTerms: 'cash', amount: (income * 40) / 100 },
    { incomeType: 'formal', paymentTerms: 'credit', amount: (income * 30) / 100 },
    { incomeType: 'informal', paymentTerms: 'cash', amount: (income * 20) / 100 },
    { incomeType: 'informal', paymentTerms: 'credit', amount: (income * 10) / 100 },
  ];
  return {
    date: `2026-${String(index + 1).padStart(2, '0')}-28`,
    income,
    expenses: (170 + index * 32) * 1_000_000,
    incomeReturns: (8 + index * 2) * 1_000_000,
    expenseReturns: (4 + index) * 1_000_000,
    incomeAllocations,
  };
});
export interface DemoFilters {
  asOf: string;
  timeGrain?: 'day' | 'month' | 'year';
  solarMonth?: string;
  incomeType: IncomeType | '';
  paymentTerms: PaymentTerms | '';
}
export const demoDefaults: DemoFilters = {
  asOf: '2026-06-30',
  incomeType: '',
  paymentTerms: '',
};
export const queryDemo = (query: Query, filters: DemoFilters): Record<string, unknown>[] => {
  const measure = query.measures?.[0] ?? 'income';
  const requestedDimension = query.dimensions?.[0];
  const dimension =
    requestedDimension && ['day', 'month', 'year'].includes(requestedDimension)
      ? (filters.timeGrain ?? requestedDimension)
      : requestedDimension;
  if (!demoMeasures.some((key) => key === measure)) throw new Error('Unknown sample measure');
  if (dimension && !demoDimensions.some((key) => key === dimension))
    throw new Error('Unknown sample dimension');
  if (!supportsDemoDimension(measure, dimension ?? '')) return [];
  const entries: {
    date: string;
    value: number;
    incomeType?: IncomeType;
    paymentTerms?: PaymentTerms;
  }[] = [];
  if (measure === 'purchases' || measure === 'latestPurchases') {
    for (const purchase of demoPurchases)
      if (purchase.confirmed && purchase.date <= filters.asOf)
        entries.push({ date: purchase.date, value: purchase.amount });
  } else if (isIncomeMeasure(measure)) {
    for (const entry of demoRecognition) {
      if (entry.date > filters.asOf) continue;
      for (const allocation of entry.incomeAllocations) {
        if (filters.incomeType && allocation.incomeType !== filters.incomeType) continue;
        if (filters.paymentTerms && allocation.paymentTerms !== filters.paymentTerms) continue;
        if (measure === 'formalIncome' && allocation.incomeType !== 'formal') continue;
        if (measure === 'informalIncome' && allocation.incomeType !== 'informal') continue;
        if (measure === 'cashIncome' && allocation.paymentTerms !== 'cash') continue;
        if (measure === 'creditIncome' && allocation.paymentTerms !== 'credit') continue;
        entries.push({
          date: entry.date,
          value:
            measure === 'incomeReturns'
              ? (allocation.amount / entry.income) * entry.incomeReturns
              : allocation.amount,
          incomeType: allocation.incomeType,
          paymentTerms: allocation.paymentTerms,
        });
      }
    }
  } else if (
    measure === 'expenses' ||
    measure === 'latestExpenses' ||
    measure === 'expenseReturns'
  ) {
    for (const entry of demoRecognition)
      if (entry.date <= filters.asOf)
        entries.push({
          date: entry.date,
          value: measure === 'expenseReturns' ? entry.expenseReturns : entry.expenses,
        });
  }
  if (filters.solarMonth) {
    for (let index = entries.length - 1; index >= 0; index--)
      if (solarKey(entries[index].date, 'month') !== filters.solarMonth) entries.splice(index, 1);
  }
  if (measure === 'latestExpenses' || measure === 'latestPurchases') {
    const latestMonth = entries.reduce(
      (latest, entry) =>
        solarKey(entry.date, 'month') > latest ? solarKey(entry.date, 'month') : latest,
      '',
    );
    return [
      {
        [measure]: entries
          .filter((entry) => solarKey(entry.date, 'month') === latestMonth)
          .reduce((sum, entry) => sum + entry.value, 0),
      },
    ];
  }
  const groups = new Map<string, number>();
  if (!dimension) groups.set('', 0);
  const timeKey = (date: string) =>
    solarKey(date, dimension === 'day' ? 'day' : dimension === 'year' ? 'year' : 'month');
  if (dimension && ['day', 'month', 'year'].includes(dimension)) {
    const end = filters.asOf < '2026-06-30' ? filters.asOf : '2026-06-30';
    for (
      const date = new Date('2026-01-01T00:00:00Z');
      date.toISOString().slice(0, 10) <= end;
      date.setUTCDate(date.getUTCDate() + 1)
    ) {
      const isoDate = date.toISOString().slice(0, 10);
      if (!filters.solarMonth || solarKey(isoDate, 'month') === filters.solarMonth)
        groups.set(timeKey(isoDate), 0);
    }
  }
  for (const entry of entries) {
    const label =
      dimension === 'incomeType'
        ? (entry.incomeType ?? '')
        : dimension === 'paymentTerms'
          ? (entry.paymentTerms ?? '')
          : dimension && ['day', 'month', 'year'].includes(dimension)
            ? timeKey(entry.date)
            : '';
    groups.set(label, (groups.get(label) ?? 0) + entry.value);
  }
  return [...groups].map(([label, value]) => ({
    ...(dimension ? { [dimension]: label } : {}),
    [measure]: value,
  }));
};
export const loadDemoQuery = (query: Query, filters: DemoFilters) =>
  Promise.resolve(queryDemo(query, filters));
export const initialDemoWidgets = (): DashboardWidget[] => [
  { id: 'income', title: '', visual: 'card', size: 'small', query: { measures: ['income'] } },
  {
    id: 'formalIncome',
    title: '',
    visual: 'card',
    size: 'small',
    query: { measures: ['formalIncome'] },
  },
  {
    id: 'informalIncome',
    title: '',
    visual: 'card',
    size: 'small',
    query: { measures: ['informalIncome'] },
  },
  {
    id: 'cashIncome',
    title: '',
    visual: 'card',
    size: 'small',
    query: { measures: ['cashIncome'] },
  },
  {
    id: 'incomeTypes',
    title: '',
    visual: 'pie',
    size: 'medium',
    chartWidth: 'half',
    query: { measures: ['income'], dimensions: ['incomeType'] },
    showValues: false,
  },
  {
    id: 'incomeTerms',
    title: '',
    visual: 'bar',
    size: 'medium',
    chartWidth: 'half',
    query: { measures: ['income'], dimensions: ['paymentTerms'] },
    showValues: false,
  },
  {
    id: 'combinedIncomeTrend',
    title: '',
    visual: 'line',
    size: 'medium',
    query: { measures: ['income'], dimensions: ['month'] },
    showValues: false,
  },
  {
    id: 'combinedExpenseTrend',
    title: '',
    visual: 'bar',
    size: 'medium',
    query: { measures: ['expenses'], dimensions: ['month'] },
    showValues: false,
  },
  {
    id: 'combinedIncomeTable',
    title: '',
    visual: 'table',
    size: 'wide',
    tableWidth: 'full',
    query: { measures: ['income'], dimensions: ['month'] },
  },
];

export const initialExpenseWidgets = (): DashboardWidget[] => [
  {
    id: 'expenseTotal',
    title: '',
    visual: 'card',
    size: 'small',
    query: { measures: ['expenses'] },
  },
  {
    id: 'purchaseTotal',
    title: '',
    visual: 'card',
    size: 'small',
    query: { measures: ['purchases'] },
  },
  {
    id: 'latestExpenseCard',
    title: '',
    visual: 'card',
    size: 'small',
    query: { measures: ['latestExpenses'] },
  },
  {
    id: 'latestPurchaseCard',
    title: '',
    visual: 'card',
    size: 'small',
    query: { measures: ['latestPurchases'] },
  },
  {
    id: 'expenseTrend',
    title: '',
    visual: 'line',
    size: 'medium',
    query: { measures: ['expenses'], dimensions: ['month'] },
  },
  {
    id: 'purchaseTrend',
    title: '',
    visual: 'line',
    size: 'medium',
    query: { measures: ['purchases'], dimensions: ['month'] },
  },
  {
    id: 'expenseBars',
    title: '',
    visual: 'horizontalBar',
    size: 'medium',
    query: { measures: ['expenses'], dimensions: ['month'] },
  },
  {
    id: 'purchaseBars',
    title: '',
    visual: 'bar',
    size: 'medium',
    query: { measures: ['purchases'], dimensions: ['month'] },
  },
  {
    id: 'expenseDetails',
    title: '',
    visual: 'table',
    size: 'wide',
    tableWidth: 'full',
    query: { measures: ['expenses'], dimensions: ['month'] },
  },
];

export const initialIncomeExpenseWidgets = (): DashboardWidget[] => [
  {
    id: 'combinedIncome',
    title: '',
    visual: 'card',
    size: 'small',
    query: { measures: ['income'] },
  },
  {
    id: 'combinedExpenses',
    title: '',
    visual: 'card',
    size: 'small',
    query: { measures: ['expenses'] },
  },
  {
    id: 'incomeReturns',
    title: '',
    visual: 'card',
    size: 'small',
    query: { measures: ['incomeReturns'] },
  },
  {
    id: 'expenseReturns',
    title: '',
    visual: 'card',
    size: 'small',
    query: { measures: ['expenseReturns'] },
  },
  {
    id: 'combinedIncomeTrend',
    title: '',
    visual: 'line',
    size: 'medium',
    query: { measures: ['income'], dimensions: ['month'] },
  },
  {
    id: 'incomeRadar',
    title: '',
    visual: 'radar',
    size: 'medium',
    query: { measures: ['income'], dimensions: ['month'] },
  },
  {
    id: 'incomeTypes',
    title: '',
    visual: 'pie',
    size: 'medium',
    query: { measures: ['income'], dimensions: ['incomeType'] },
  },
  {
    id: 'incomeTerms',
    title: '',
    visual: 'bar',
    size: 'medium',
    query: { measures: ['income'], dimensions: ['paymentTerms'] },
  },
  {
    id: 'combinedExpenseTable',
    title: '',
    visual: 'table',
    size: 'wide',
    tableWidth: 'full',
    query: { measures: ['expenses'], dimensions: ['month'] },
  },
];
