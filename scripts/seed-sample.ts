import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { dataDirectory, readStore, updateStore } from '../src/server/flows/store';
import { sampleRows } from '../src/server/flows/sample';
import type { DataFlow, ReportWidget } from '../src/lib/flows/types';

const username = process.argv[2];
if (!username || !readStore().users.some(user => user.username === username)) {
  throw new Error('Usage: node --import tsx scripts/seed-sample.ts <existing-username>');
}
const directory = dataDirectory();
copyFileSync(path.join(directory, 'workspace.enc'), path.join(directory, `workspace.before-sample-${Date.now()}.enc`));
const now = new Date().toISOString();
updateStore(state => {
  const user = state.users.find(user => user.username === username)!;
  user.dataAccess = true;
  const id = 'sample_orders';
  const flow: DataFlow = {
    id, name: 'SAMPLE — Fictional orders / سفارش‌های ساختگی', kind: 'csv', sampleData: true,
    columns: Object.keys(sampleRows[0]).map(name => ({source:name,target:name,type:name === 'units' ? 'Int64' : name === 'order_date' ? 'Date' : 'String',required:true})),
    primaryKey: 'order_id', grain: 'One fictional order', status: 'published',
    activeLoadId: 'sample_v1', rowCount: sampleRows.length, publishedAt: now, createdAt: now,
  };
  if (!state.flows.some(item => item.id === id)) state.flows.push(flow);
  const specs: [string, ReportWidget['kind'], string, string, ReportWidget['aggregation']][] = [
    ['SAMPLE — Orders / سفارش‌ها','kpi','','','count'],
    ['SAMPLE — Units / تعداد کالا','kpi','','units','sum'],
    ['SAMPLE — Units by region / کالا بر اساس منطقه','bar','region','units','sum'],
    ['SAMPLE — Orders by product / سفارش بر اساس محصول','pie','product','','count'],
    ['SAMPLE — Daily orders / سفارش‌های روزانه','line','order_date','','count'],
    ['SAMPLE — Order status / وضعیت سفارش','table','status','','count'],
  ];
  if (!state.reports.some(report => report.id === 'sample_dashboard')) state.reports.unshift({
    id:'sample_dashboard',name:'SAMPLE — Interactive dashboard / داشبورد آزمایشی',ownerId:user.id,revision:1,updatedAt:now,
    widgets: specs.map(([title,kind,dimension,measure,aggregation],i) => ({id:`sample_widget_${i}`,title,kind,dimension,measure,aggregation,flowId:id})),
  });
  state.audit.push({id:`sample_seed_${Date.now()}`,at:now,actorId:user.id,action:'sample.seed',targetId:id});
});
console.log('Added 180 fictional orders and a six-visual draft dashboard. Existing records preserved; encrypted backup created.');
