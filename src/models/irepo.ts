import { DBItemBase } from "./ddb";

export interface IRepo<
  T extends DBItemBase,
  P extends string & keyof T,
  S extends (string & keyof T) | undefined = undefined
> {
  findItem(
    key: { [Q in P | S]: T[Q] },
    projectionExpression?: (keyof T)[]
  ): Promise<Partial<T> | undefined>;
  searchItems(
    keyConditionExpression: string,
    expressionAttributeValues: Partial<T>,
    indexName?: string,
    projectionExpression?: (keyof T)[],
    expressionAttributeNames?: Record<string, string>
  ): Promise<Partial<T>[]>;
  addItem(item: Partial<T>, replaceTimestamps?: boolean): Promise<void>;
  updateItem(
    key: { [Q in P | S]: T[Q] },
    item: Partial<T>,
    replaceTimestamp?: boolean
  ): Promise<void>;
  updateExpressionItem(
    key: { [Q in P | S]: T[Q] },
    updateExpression: string,
    additionalExpressionAttributeValues: Record<string, unknown>,
    item: Partial<T>,
    expressionAttributeNames?: Record<string, string>,
    replaceTimestamp?: boolean
  ): Promise<void>;
  deleteItem(key: { [Q in P | S]: T[Q] }): Promise<void>;
  getAllItems(projectionExpression?: (keyof T)[]): Promise<T[]>;
  batchGetItems(keys: { [Q in P | S]: T[Q] }[]): Promise<T[]>;
}
