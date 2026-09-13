export interface MockSupabaseQueryResult {
  data: any[];
  error: null;
}

export type MockTableData = Record<string, any[]>;

class MockSupabaseQueryBuilder {
  private filters: Array<{ type: "eq" | "in"; field: string; value: any }> = [];
  private orderField?: string;
  private orderAscending = true;

  constructor(private table: string, private tableData: MockTableData) {}

  select(_columns: string) {
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ type: "eq", field, value });
    return this;
  }

  in(field: string, values: any[]) {
    this.filters.push({ type: "in", field, value: values });
    return this;
  }

  order(field: string, options?: { ascending?: boolean }) {
    this.orderField = field;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  then(resolve: (value: MockSupabaseQueryResult) => any, reject?: (reason: any) => any) {
    const result = this.execute();
    return Promise.resolve(result).then(resolve, reject);
  }

  private execute(): MockSupabaseQueryResult {
    let rows = Array.from(this.tableData[this.table] ?? []);

    for (const filter of this.filters) {
      if (filter.type === "eq") {
        rows = rows.filter((row) => row?.[filter.field] === filter.value);
      } else if (filter.type === "in") {
        rows = rows.filter((row) => filter.value.includes(row?.[filter.field]));
      }
    }

    if (this.orderField) {
      rows.sort((left, right) => {
        const leftValue = left?.[this.orderField!];
        const rightValue = right?.[this.orderField!];
        if (leftValue === rightValue) return 0;
        if (leftValue === undefined || leftValue === null) return 1;
        if (rightValue === undefined || rightValue === null) return -1;
        return this.orderAscending ? String(leftValue).localeCompare(String(rightValue)) : String(rightValue).localeCompare(String(leftValue));
      });
    }

    return { data: rows, error: null };
  }
}

export function createSupabaseMock(initialData: MockTableData) {
  return {
    from: (table: string) => new MockSupabaseQueryBuilder(table, initialData),
  };
}
