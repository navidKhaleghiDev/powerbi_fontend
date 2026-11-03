import { describe, expect, it } from 'vitest';
import { sampleAnalytics, sampleRows } from '../sample';
import type { ReportWidget } from '@/lib/flows/types';
const widget: ReportWidget = {id:'sample',title:'Sample',flowId:'sample_orders',kind:'kpi',dimension:'',measure:'',aggregation:'count'};
describe('explicit synthetic data', () => {
  it('has stable unique keys and counts all fictional orders', () => {
    expect(new Set(sampleRows.map(row => row.order_id)).size).toBe(180);
    expect(sampleAnalytics(widget)).toEqual([{label:'',value:180}]);
  });
  it('applies combined category and date filters before aggregation', () => {
    const result = sampleAnalytics({...widget,filterField:'region',filterValue:'Tehran',dateField:'order_date',dateFrom:'2026-06-01',dateTo:'2026-06-30'});
    expect(result).toEqual([{label:'',value:6}]);
  });
  it('groups counts without dropping orders and limits chart output', () => {
    const groups = sampleAnalytics({...widget,kind:'pie',dimension:'product'});
    expect(groups).toHaveLength(4);
    expect(groups.reduce((sum,row) => sum + row.value,0)).toBe(180);
    expect(sampleAnalytics({...widget,kind:'line',dimension:'order_date'})).toHaveLength(50);
  });
});
