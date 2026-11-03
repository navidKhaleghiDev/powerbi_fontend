"use client";
import { useState } from "react";

import { useTranslations } from "next-intl";
import { useForm } from "react-hook-form";

import {
  useCsvPreview,
  useSourceTables,
  useWorkspaceAction,
} from "@/hooks/useWorkspace";
import type {
  ColumnMapping,
  ColumnType,
  DataFlow,
  PublicConnection,
} from "@/lib/flows/types";

import {
  Field,
  Notice,
  buttonClass,
  inputClass,
  secondaryClass,
} from "./FormParts";
interface Props {
  connections: PublicConnection[];
}
interface Draft {
  name: string;
  grain: string;
}
const defaultMapping = (names: string[]): ColumnMapping[] =>
  names.map((name, index) => ({
    source: name,
    target: /^[A-Za-z][A-Za-z0-9_]{0,62}$/.test(name)
      ? name
      : `column_${index + 1}`,
    type: "String",
    required: false,
  }));
export const FlowDesigner = ({ connections }: Props) => {
  const t = useTranslations("studio");
  const [kind, setKind] = useState<"csv" | "postgres">("csv");
  const [connectionId, setConnectionId] = useState("");
  const [tableIndex, setTableIndex] = useState("");
  const [columns, setColumns] = useState<ColumnMapping[]>([]);
  const [primaryKey, setPrimaryKey] = useState("");
  const tables = useSourceTables(connectionId);
  const preview = useCsvPreview();
  const save = useWorkspaceAction<DataFlow>();
  const upload = useWorkspaceAction();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Draft>({ defaultValues: { name: "", grain: "" } });
  const updateColumn = (index: number, patch: Partial<ColumnMapping>) =>
    setColumns((values) =>
      values.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    );
  const selected = tables.data?.[Number(tableIndex)];
  const submit = ({ name, grain }: Draft) => {
    save.mutate(
      {
        path: "flows",
        body: {
          name,
          grain,
          kind,
          connectionId: kind === "postgres" ? connectionId : undefined,
          schema: kind === "postgres" ? selected?.schema : undefined,
          table: kind === "postgres" ? selected?.name : undefined,
          columns,
          primaryKey,
        },
      },
      {
        onSuccess: (flow) => {
          if (kind === "csv" && preview.data)
            upload.mutate({
              path: `flows/${flow.id}/import`,
              body: { csv: preview.data.csv, fileName: preview.data.fileName },
            });
        },
      },
    );
  };
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-lg font-bold">{t("newFlow")}</h2>
        <p className="mt-1 text-sm text-slate-500">{t("flowHelp")}</p>
      </div>
      <div className="flex flex-wrap gap-3">
        {(["csv", "postgres"] as const).map((value) => (
          <button
            type="button"
            key={value}
            aria-pressed={kind === value}
            className={kind === value ? buttonClass : secondaryClass}
            onClick={() => {
              setKind(value);
              setColumns([]);
              setPrimaryKey("");
            }}
          >
            {t(value === "csv" ? "csvSource" : "postgresSource")}
          </button>
        ))}
      </div>
      {kind === "csv" ? (
        <div className="rounded-2xl border border-dashed border-teal-300 bg-teal-50 p-5">
          <Field label={t("chooseCsv")}>
            <input
              type="file"
              accept=".csv,text/csv"
              className={inputClass}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file)
                  preview.mutate(file, {
                    onSuccess: (result) => {
                      setColumns(defaultMapping(result.columns));
                      setPrimaryKey("");
                    },
                  });
              }}
            />
          </Field>
          <p className="mt-2 text-xs text-slate-600">{t("csvHelp")}</p>
          <Notice error={preview.error} />
          {preview.data && (
            <p className="mt-2 text-sm">
              {t("previewCount", { count: preview.data.rowCount })}
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-2">
          <Field label={t("connection")}>
            <select
              className={inputClass}
              value={connectionId}
              onChange={(event) => {
                setConnectionId(event.target.value);
                setTableIndex("");
                setColumns([]);
              }}
            >
              <option value="">{t("selectConnection")}</option>
              {connections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("sourceTable")}>
            <select
              className={inputClass}
              value={tableIndex}
              disabled={!tables.data}
              onChange={(event) => {
                setTableIndex(event.target.value);
                const table = tables.data?.[Number(event.target.value)];
                if (table) {
                  setColumns(
                    defaultMapping(table.columns.map((c) => c.name)).map(
                      (c) => ({
                        ...c,
                        required: !table.columns.find(
                          (s) => s.name === c.source,
                        )?.nullable,
                      }),
                    ),
                  );
                  const key = table.columns.filter((c) => c.primaryKey);
                  setPrimaryKey(key.length === 1 ? key[0].name : "");
                }
              }}
            >
              <option value="">
                {tables.isFetching ? t("discovering") : t("selectTable")}
              </option>
              {tables.data?.map((table, index) => (
                <option key={`${table.schema}.${table.name}`} value={index}>
                  {table.schema}.{table.name}
                </option>
              ))}
            </select>
          </Field>
          <Notice error={tables.error} />
          <p className="text-xs text-slate-500 sm:col-span-2">
            {t("cdcPrerequisites")}
          </p>
        </div>
      )}
      <form onSubmit={handleSubmit(submit)} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("flowName")}>
            <input
              className={inputClass}
              {...register("name", { required: true, maxLength: 100 })}
            />
          </Field>
          <Field label={t("grain")}>
            <input
              className={inputClass}
              {...register("grain", { required: true, maxLength: 100 })}
            />
          </Field>
        </div>
        {columns.length > 0 && (
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-slate-50 text-start">
                <tr>
                  {[
                    "sourceColumn",
                    "warehouseColumn",
                    "columnType",
                    "required",
                    "include",
                  ].map((key) => (
                    <th key={key} className="p-3 text-start">
                      {t(key)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {columns.map((column, index) => (
                  <tr key={column.source} className="border-t border-slate-100">
                    <td className="p-3 font-mono">{column.source}</td>
                    <td className="p-3">
                      <input
                        aria-label={t("warehouseColumn") + " " + column.source}
                        className={inputClass}
                        value={column.target}
                        onChange={(e) =>
                          updateColumn(index, { target: e.target.value })
                        }
                      />
                    </td>
                    <td className="p-3">
                      <select
                        aria-label={t("columnType") + " " + column.source}
                        className={inputClass}
                        value={column.type}
                        onChange={(e) =>
                          updateColumn(index, {
                            type: e.target.value as ColumnType,
                          })
                        }
                      >
                        {[
                          "String",
                          "Int64",
                          "Float64",
                          "Decimal(18,2)",
                          "Date",
                        ].map((value) => (
                          <option key={value}>{value}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      <input
                        type="checkbox"
                        aria-label={t("required") + " " + column.source}
                        checked={column.required}
                        onChange={(e) =>
                          updateColumn(index, { required: e.target.checked })
                        }
                      />
                    </td>
                    <td className="p-3">
                      <button
                        type="button"
                        className="text-red-700 underline"
                        onClick={() =>
                          setColumns((items) =>
                            items.filter((_, i) => i !== index),
                          )
                        }
                      >
                        {t("exclude")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Field label={t("primaryKey")}>
          <select
            className={inputClass}
            value={primaryKey}
            onChange={(e) => setPrimaryKey(e.target.value)}
          >
            <option value="">{t("selectKey")}</option>
            {columns.map((c) => (
              <option key={c.source} value={c.target}>
                {c.target}
              </option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-slate-500">{t("mappingHelp")}</p>
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="text-red-700">
            {t("errors.invalid")}
          </p>
        )}
        <button
          className={buttonClass}
          disabled={
            !columns.length || !primaryKey || save.isPending || upload.isPending
          }
        >
          {save.isPending || upload.isPending
            ? t("working")
            : t(kind === "csv" ? "createAndImport" : "saveFlow")}
        </button>
      </form>
      <Notice
        error={save.error || upload.error}
        success={kind === "csv" ? upload.isSuccess : save.isSuccess}
        text={t(kind === "csv" ? "importSucceeded" : "saved")}
      />
    </section>
  );
};
