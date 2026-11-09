import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import {
  BarChart3,
  ChartBar,
  ChartLine,
  ChartPie,
  LayoutGrid,
  Grid2X2,
  Radar,
  Plus,
  RefreshCw,
  Table2,
  Type,
  X,
} from 'lucide-react';
import { Dialog } from 'radix-ui';
import { useState, type SetStateAction } from 'react';
import DateObject from 'react-date-object';
import gregorian from 'react-date-object/calendars/gregorian';
import persian from 'react-date-object/calendars/persian';
import gregorianEn from 'react-date-object/locales/gregorian_en';
import persianEn from 'react-date-object/locales/persian_en';
import persianFa from 'react-date-object/locales/persian_fa';
import DatePickerModule from 'react-multi-date-picker';
import { useLocale, useTranslations } from 'use-intl';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { NativeSelect } from '@/components/ui/native-select';
import {
  demoDefaults,
  demoDimensions,
  demoMeasures,
  initialIncomeExpenseWidgets,
  isIncomeMeasure,
  type DemoFilters,
  supportsDemoDimension,
} from '@/lib/sales-demo';
import { demoSolarMonths, formatSolarPeriod, toSolarDate } from '@/lib/solar-calendar';

import { DashboardChat } from './DashboardChat';
import { DashboardPane } from './DashboardPane';
import { DashboardWidgetCard } from './DashboardWidgetCard';
import { DemoQueryEditor } from './DemoQueryEditor';

import type { DashboardSheet, DashboardWidget, WidgetVisual } from '@/lib/dashboard';

// The CommonJS package can arrive as a module wrapper in Vite development.
const DatePicker = (
  'default' in DatePickerModule ? DatePickerModule.default : DatePickerModule
) as typeof DatePickerModule;

const categoryPalette = ['#0d9488', '#6366f1', '#f59e0b', '#e11d48', '#8b5cf6', '#0284c7'];

const visuals = [
  { kind: 'bar', Icon: BarChart3 },
  { kind: 'horizontalBar', Icon: ChartBar },
  { kind: 'line', Icon: ChartLine },
  { kind: 'pie', Icon: ChartPie },
  { kind: 'radar', Icon: Radar },
  { kind: 'heatmap', Icon: Grid2X2 },
  { kind: 'card', Icon: Type },
  { kind: 'table', Icon: Table2 },
] as const;

export const DashboardPage = () => {
  const t = useTranslations('dashboard');
  const demo = useTranslations('salesDemo');
  const locale = useLocale();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );
  const [sheetFilters, setSheetFilters] = useState<Record<string, DemoFilters>>({});
  const queryClient = useQueryClient();
  const refreshing = useIsFetching({ queryKey: ['dashboard-widget'] }) > 0;
  const [sheets, setSheets] = useState<DashboardSheet[]>(() => [
    { id: 'sales', name: '', widgets: initialIncomeExpenseWidgets() },
  ]);
  const [activeSheetId, setActiveSheetId] = useState('sales');
  const [creatingSheet, setCreatingSheet] = useState(false);
  const [sheetName, setSheetName] = useState('');
  const [sheetMeasures, setSheetMeasures] = useState<string[]>(['income']);
  const [sheetDimension, setSheetDimension] = useState('month');
  const [sheetVisual, setSheetVisual] = useState<WidgetVisual>('bar');
  const widgets = sheets.find((sheet) => sheet.id === activeSheetId)?.widgets ?? [];
  const filters = sheetFilters[activeSheetId] ?? demoDefaults;
  const setFilters = (action: SetStateAction<DemoFilters>) =>
    setSheetFilters((current) => ({
      ...current,
      [activeSheetId]:
        typeof action === 'function' ? action(current[activeSheetId] ?? demoDefaults) : action,
    }));
  const activeFilters = [
    ...(filters.asOf !== demoDefaults.asOf
      ? [
          {
            key: 'asOf',
            label: `${demo('asOf')}: ${formatSolarPeriod(toSolarDate(filters.asOf).format('YYYY-MM-DD'), 'day', locale)}`,
            clear: () => setFilters((current) => ({ ...current, asOf: demoDefaults.asOf })),
          },
        ]
      : []),
    ...(filters.timeGrain && filters.timeGrain !== 'month'
      ? [
          {
            key: 'timeGrain',
            label: `${t('timeGrain')}: ${t(filters.timeGrain === 'day' ? 'daily' : 'yearly')}`,
            clear: () => setFilters((current) => ({ ...current, timeGrain: undefined })),
          },
        ]
      : []),
    ...(filters.solarMonth
      ? [
          {
            key: 'solarMonth',
            label: `${t('solarMonth')}: ${formatSolarPeriod(filters.solarMonth, 'month', locale)}`,
            clear: () => setFilters((current) => ({ ...current, solarMonth: '' })),
          },
        ]
      : []),
    ...(filters.incomeType
      ? [
          {
            key: 'incomeType',
            label: `${demo('fields.incomeType')}: ${demo(`values.${filters.incomeType}`)}`,
            clear: () => setFilters((current) => ({ ...current, incomeType: '' })),
          },
        ]
      : []),
    ...(filters.paymentTerms
      ? [
          {
            key: 'paymentTerms',
            label: `${demo('fields.paymentTerms')}: ${demo(`values.${filters.paymentTerms}`)}`,
            clear: () => setFilters((current) => ({ ...current, paymentTerms: '' })),
          },
        ]
      : []),
  ];
  const hasIncome = widgets.some((widget) => widget.query?.measures?.some(isIncomeMeasure));
  const setWidgets = (action: SetStateAction<DashboardWidget[]>) =>
    setSheets((items) =>
      items.map((sheet) =>
        sheet.id === activeSheetId
          ? { ...sheet, widgets: typeof action === 'function' ? action(sheet.widgets) : action }
          : sheet,
      ),
    );
  const switchSheet = (id: string) => {
    setEditingId(null);
    setActiveSheetId(id);
  };
  const [editingId, setEditingId] = useState<string | null>(null);
  const editing = widgets.find((widget) => widget.id === editingId);
  const update = (id: string, patch: Partial<DashboardWidget>) =>
    setWidgets((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  const add = (visual: WidgetVisual) => {
    const widget: DashboardWidget = {
      id: crypto.randomUUID(),
      title: t('defaultTitle', { type: t(`visuals.${visual}`), count: widgets.length + 1 }),
      visual,
      size: visual === 'card' ? 'small' : 'medium',
      query: null,
    };
    setWidgets((items) => [...items, widget]);
    setEditingId(widget.id);
  };
  return (
    <section className="bi-dashboard" aria-label={t('canvas')}>
      <nav className="bi-toolbar" aria-label={t('toolbar')}>
        <div className="bi-toolbar-title">
          <LayoutGrid size={17} aria-hidden="true" />
          <span>{t('title')}</span>
          <span className="bi-sample-badge">{demo('data')}</span>
        </div>
        <div className="bi-toolbar-insert" role="group" aria-label={t('visualizations')}>
          {visuals.map(({ kind, Icon }) => (
            <Button
              key={kind}
              type="button"
              variant="ghost"
              size="icon-sm"
              title={t(`visuals.${kind}`)}
              aria-label={t(`visuals.${kind}`)}
              onClick={() => add(kind)}
            >
              <Icon aria-hidden="true" />
            </Button>
          ))}
        </div>
        <div className="bi-toolbar-actions">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title={t('refreshAll')}
            aria-label={t('refreshAll')}
            disabled={refreshing || !widgets.some((widget) => widget.query)}
            onClick={() => void queryClient.invalidateQueries({ queryKey: ['dashboard-widget'] })}
          >
            <RefreshCw aria-hidden="true" className={refreshing ? 'animate-spin' : ''} />
          </Button>
        </div>
      </nav>
      <div className="bi-board-layout">
        <div className="bi-canvas-area">
          {activeFilters.length > 0 && (
            <div className="bi-active-filters" role="group" aria-label={t('activeFilters')}>
              <span>{t('activeFilters')}</span>
              {activeFilters.map((filter) => (
                <Button
                  key={filter.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={filter.clear}
                  aria-label={t('clearFilter', { name: filter.label })}
                >
                  {filter.label}
                  <X size={14} aria-hidden="true" />
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFilters(demoDefaults)}
              >
                {t('resetFilters')}
              </Button>
            </div>
          )}
          <div
            className="bi-sheet-content"
            role="tabpanel"
            id={`bi-sheet-panel-${activeSheetId}`}
            aria-labelledby={`bi-sheet-tab-${activeSheetId}`}
          >
            {!widgets.length ? (
              <div className="bi-empty-board">
                <span className="bi-empty-art">
                  <LayoutGrid size={54} strokeWidth={1} />
                </span>
                <p className="bi-eyebrow">{t('startLabel')}</p>
                <h2>{t('emptyTitle')}</h2>
                <p>{demo('emptyHint')}</p>
                <Button onClick={() => add('bar')}>
                  <Plus />
                  {t('firstWidget')}
                </Button>
                <small>{demo('dataNote')}</small>
              </div>
            ) : (
              <DndContext
                key={activeSheetId}
                sensors={sensors}
                collisionDetection={closestCenter}
                accessibility={{
                  screenReaderInstructions: { draggable: t('dragInstructions') },
                  announcements: {
                    onDragStart: () => t('dragStarted'),
                    onDragOver: ({ over }) => (over ? t('dragOver') : undefined),
                    onDragEnd: () => t('dragDropped'),
                    onDragCancel: () => t('dragCancelled'),
                  },
                }}
                onDragEnd={({ active, over }) => {
                  if (!over || active.id === over.id) return;
                  setWidgets((items) => {
                    const from = items.findIndex((item) => item.id === active.id);
                    const to = items.findIndex((item) => item.id === over.id);
                    if (from < 0 || to < 0) return items;
                    const next = [...items];
                    const moved = next.splice(from, 1)[0];
                    if (!moved) return items;
                    next.splice(to, 0, moved);
                    return next;
                  });
                }}
              >
                <div className="bi-widget-grid">
                  {widgets.map((widget, index) => (
                    <DashboardWidgetCard
                      key={widget.id}
                      widget={{ ...widget, title: widget.title || demo(`widgets.${widget.id}`) }}
                      filters={filters}
                      first={index === 0}
                      last={index === widgets.length - 1}
                      onEdit={() => setEditingId(widget.id)}
                      onTableWidthChange={(tableWidth) => update(widget.id, { tableWidth })}
                      onRemove={() =>
                        setWidgets((items) => items.filter((item) => item.id !== widget.id))
                      }
                      onDuplicate={() =>
                        setWidgets((items) => [
                          ...items,
                          {
                            ...widget,
                            id: crypto.randomUUID(),
                            title: t('copyTitle', {
                              title: widget.title || demo(`widgets.${widget.id}`),
                            }),
                          },
                        ])
                      }
                      onMove={(offset) =>
                        setWidgets((items) => {
                          const next = [...items];
                          const target = index + offset;
                          if (target < 0 || target >= next.length) return items;
                          [next[index], next[target]] = [next[target], next[index]];
                          return next;
                        })
                      }
                    />
                  ))}
                </div>
              </DndContext>
            )}
          </div>
          <footer className="bi-canvas-footer">
            <div className="bi-sheet-tabs" role="tablist" aria-label={t('sheets')}>
              {sheets.map((sheet, index) => (
                <Button
                  variant="ghost"
                  size="auto"
                  type="button"
                  role="tab"
                  key={sheet.id}
                  id={`bi-sheet-tab-${sheet.id}`}
                  aria-controls={`bi-sheet-panel-${sheet.id}`}
                  aria-selected={activeSheetId === sheet.id}
                  tabIndex={activeSheetId === sheet.id ? 0 : -1}
                  className="bi-sheet-tab"
                  onClick={() => switchSheet(sheet.id)}
                  onKeyDown={(event) => {
                    const forward = locale === 'fa' ? 'ArrowLeft' : 'ArrowRight';
                    const backward = locale === 'fa' ? 'ArrowRight' : 'ArrowLeft';
                    if (![forward, backward, 'Home', 'End'].includes(event.key)) return;
                    event.preventDefault();
                    const target =
                      event.key === 'Home'
                        ? 0
                        : event.key === 'End'
                          ? sheets.length - 1
                          : (index + (event.key === forward ? 1 : -1) + sheets.length) %
                            sheets.length;
                    const next = sheets[target];
                    if (!next) return;
                    switchSheet(next.id);
                    event.currentTarget.parentElement
                      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
                      [target]?.focus();
                  }}
                >
                  {sheet.id === 'sales' ? t('salesSheet') : sheet.name}
                </Button>
              ))}
            </div>
            <Button
              type="button"
              className="bi-add-sheet"
              variant="ghost"
              size="icon-sm"
              title={t('addSheet')}
              aria-label={t('addSheet')}
              onClick={() => {
                setSheetName(t('defaultSheetName', { count: sheets.length + 1 }));
                setCreatingSheet(true);
              }}
            >
              <Plus aria-hidden="true" />
            </Button>
            <span>{t('canvasHint')}</span>
          </footer>
        </div>
        <DashboardPane className="bi-filter-pane" title={t('filtersTitle')}>
          <form
            className="bi-dashboard-filters"
            aria-label={t('filtersTitle')}
            onSubmit={(event) => event.preventDefault()}
          >
            <label>
              {demo('asOf')}
              <DatePicker
                calendar={persian}
                locale={locale === 'fa' ? persianFa : persianEn}
                format="YYYY/MM/DD"
                value={toSolarDate(filters.asOf)}
                minDate={toSolarDate('2026-01-01')}
                maxDate={toSolarDate('2026-06-30')}
                editable={false}
                inputClass="bi-solar-date-input"
                onChange={(date) => {
                  if (!date?.isValid) return;
                  const value = new DateObject(date)
                    .convert(gregorian, gregorianEn)
                    .format('YYYY-MM-DD');
                  if (value >= '2026-01-01' && value <= '2026-06-30')
                    setFilters((current) => ({ ...current, asOf: value }));
                }}
              />
            </label>
            <label>
              {t('timeGrain')}
              <NativeSelect
                value={filters.timeGrain ?? 'month'}
                onChange={(event) => {
                  const value = event.target.value;
                  if (value === 'day' || value === 'month' || value === 'year')
                    setFilters((current) => ({ ...current, timeGrain: value, solarMonth: '' }));
                }}
              >
                <option value="day">{t('daily')}</option>
                <option value="month">{t('monthly')}</option>
                <option value="year">{t('yearly')}</option>
              </NativeSelect>
            </label>
            {(filters.timeGrain ?? 'month') === 'month' && (
              <label>
                {t('solarMonth')}
                <NativeSelect
                  value={filters.solarMonth ?? ''}
                  onChange={(event) =>
                    setFilters((current) => ({ ...current, solarMonth: event.target.value }))
                  }
                >
                  <option value="">{t('allMonths')}</option>
                  {demoSolarMonths().map((month) => (
                    <option key={month} value={month}>
                      {formatSolarPeriod(month, 'month', locale)}
                    </option>
                  ))}
                </NativeSelect>
              </label>
            )}
            {hasIncome && (
              <>
                <label>
                  {demo('fields.incomeType')}
                  <NativeSelect
                    value={filters.incomeType}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === '' || value === 'formal' || value === 'informal')
                        setFilters((current) => ({ ...current, incomeType: value }));
                    }}
                  >
                    <option value="">{t('allIncomeTypes')}</option>
                    <option value="formal">{demo('values.formal')}</option>
                    <option value="informal">{demo('values.informal')}</option>
                  </NativeSelect>
                </label>
                <label>
                  {demo('fields.paymentTerms')}
                  <NativeSelect
                    value={filters.paymentTerms}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === '' || value === 'cash' || value === 'credit')
                        setFilters((current) => ({ ...current, paymentTerms: value }));
                    }}
                  >
                    <option value="">{t('allPaymentTerms')}</option>
                    <option value="cash">{demo('values.cash')}</option>
                    <option value="credit">{demo('values.credit')}</option>
                  </NativeSelect>
                </label>
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFilters(demoDefaults)}
            >
              {t('resetFilters')}
            </Button>
          </form>
        </DashboardPane>
        <DashboardChat />
      </div>
      <Dialog.Root open={creatingSheet} onOpenChange={setCreatingSheet}>
        <Dialog.Portal>
          <Dialog.Overlay className="bi-editor-overlay" />
          <Dialog.Content className="bi-sheet-dialog" aria-describedby="bi-new-sheet-help">
            <Dialog.Title>{t('addSheet')}</Dialog.Title>
            <Dialog.Description id="bi-new-sheet-help">{t('newSheetHint')}</Dialog.Description>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const name = sheetName.trim();
                if (!name || !sheetMeasures.length) return;
                const id = crypto.randomUUID();
                const configuredWidgets: DashboardWidget[] = sheetMeasures.map((measure) => ({
                  id: crypto.randomUUID(),
                  title: demo(`fields.${measure}`),
                  visual: sheetVisual,
                  size: sheetVisual === 'card' ? 'small' : 'medium',
                  query: {
                    measures: [measure],
                    ...(sheetDimension ? { dimensions: [sheetDimension] } : {}),
                  },
                }));
                setSheets((items) => [...items, { id, name, widgets: configuredWidgets }]);
                switchSheet(id);
                setCreatingSheet(false);
              }}
            >
              <label>
                {t('sheetName')}
                <Input
                  autoFocus
                  required
                  maxLength={80}
                  value={sheetName}
                  onChange={(event) => setSheetName(event.target.value)}
                />
              </label>
              <div className="bi-sheet-config">
                <label>
                  {t('sheetDataSource')}
                  <NativeSelect aria-label={t('sheetDataSource')} defaultValue="sales-demo">
                    <option value="sales-demo">{demo('badge')}</option>
                  </NativeSelect>
                </label>
                <fieldset>
                  <legend>{t('sheetMeasures')}</legend>
                  <div className="bi-sheet-measure-options">
                    {demoMeasures.map((measure) => (
                      <label key={measure}>
                        <Checkbox
                          checked={sheetMeasures.includes(measure)}
                          onCheckedChange={(value) => {
                            const checked = value === true;
                            setSheetMeasures((items) =>
                              checked
                                ? [...items, measure]
                                : items.filter((item) => item !== measure),
                            );
                            if (checked && !supportsDemoDimension(measure, sheetDimension))
                              setSheetDimension('');
                          }}
                        />
                        {demo(`fields.${measure}`)}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label>
                  {demo('groupBy')}
                  <NativeSelect
                    aria-label={demo('groupBy')}
                    value={sheetDimension}
                    onChange={(event) => setSheetDimension(event.target.value)}
                  >
                    <option value="">{demo('total')}</option>
                    {demoDimensions
                      .filter((dimension) =>
                        sheetMeasures.every((measure) => supportsDemoDimension(measure, dimension)),
                      )
                      .map((dimension) => (
                        <option key={dimension} value={dimension}>
                          {demo(`fields.${dimension}`)}
                        </option>
                      ))}
                  </NativeSelect>
                </label>
                <label>
                  {t('visualizations')}
                  <NativeSelect
                    aria-label={t('visualizations')}
                    value={sheetVisual}
                    onChange={(event) => setSheetVisual(event.target.value as WidgetVisual)}
                  >
                    {visuals.map(({ kind }) => (
                      <option key={kind} value={kind}>
                        {t(`visuals.${kind}`)}
                      </option>
                    ))}
                  </NativeSelect>
                </label>
                <p>{t('sheetDataHint')}</p>
              </div>
              <div>
                <Dialog.Close asChild>
                  <Button type="button" variant="outline">
                    {t('cancelSheet')}
                  </Button>
                </Dialog.Close>
                <Button type="submit" disabled={!sheetName.trim() || !sheetMeasures.length}>
                  {t('createSheet')}
                </Button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <Dialog.Root
        open={!!editing}
        onOpenChange={(open) => {
          if (!open) setEditingId(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="bi-editor-overlay" />
          <Dialog.Content className="bi-editor" aria-describedby="bi-editor-description">
            <header className="bi-editor-heading">
              <div>
                <Dialog.Title>{t('editWidget')}</Dialog.Title>
                <Dialog.Description id="bi-editor-description">
                  {demo('editorHint')}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label={t('closeEditor')}>
                  <X />
                </Button>
              </Dialog.Close>
            </header>
            {editing && (
              <>
                <div className="bi-editor-settings">
                  <label>
                    {t('widgetTitle')}
                    <Input
                      maxLength={100}
                      value={editing.title}
                      onChange={(event) => update(editing.id, { title: event.target.value })}
                    />
                  </label>
                  <label>
                    {t('visualizations')}
                    <NativeSelect
                      value={editing.visual}
                      onChange={(event) =>
                        update(editing.id, { visual: event.target.value as WidgetVisual })
                      }
                    >
                      {visuals.map(({ kind }) => (
                        <option key={kind} value={kind}>
                          {t(`visuals.${kind}`)}
                        </option>
                      ))}
                    </NativeSelect>
                  </label>
                </div>
                {editing.visual !== 'card' && editing.visual !== 'table' && (
                  <fieldset className="bi-editor-settings">
                    <legend>{t('chartColors')}</legend>
                    {editing.visual === 'pie' ? (
                      categoryPalette.map((color, index) => (
                        <label key={color}>
                          {t('categoryColor', { number: index + 1 })}
                          <Input
                            type="color"
                            value={editing.categoryColors?.[index] ?? color}
                            onChange={(event) => {
                              const colors = categoryPalette.map(
                                (fallback, i) => editing.categoryColors?.[i] ?? fallback,
                              );
                              colors[index] = event.target.value;
                              update(editing.id, { categoryColors: colors });
                            }}
                          />
                        </label>
                      ))
                    ) : (
                      <label>
                        {t('seriesColor')}
                        <Input
                          type="color"
                          value={
                            editing.chartColor ??
                            (editing.visual === 'bar' || editing.visual === 'horizontalBar'
                              ? '#6366f1'
                              : editing.visual === 'radar'
                                ? '#8b5cf6'
                                : editing.visual === 'heatmap'
                                  ? '#0284c7'
                                  : '#0d9488')
                          }
                          onChange={(event) =>
                            update(editing.id, { chartColor: event.target.value })
                          }
                        />
                      </label>
                    )}
                  </fieldset>
                )}
                <DemoQueryEditor
                  key={editing.id}
                  initialQuery={editing.query}
                  onApply={(query) => {
                    update(editing.id, { query });
                    setEditingId(null);
                  }}
                />
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </section>
  );
};
