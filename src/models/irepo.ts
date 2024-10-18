import { DBItemBase } from "./ddb";

export interface IRepo<
  T extends DBItemBase,
  P extends string & keyof T,
  S extends (string & keyof T) | undefined = undefined
> {
  findItem(key: { [Q in P | S]: T[Q] }): Promise<T | undefined>;
  searchItems(
    keyConditionExpression: string,
    expressionAttributeValues: Partial<T>,
    indexName?: string,
    projectionExpression?: string,
    expressionAttributeNames?: Record<string, string>
  ): Promise<T[]>;
  addItem(item: T): Promise<void>;
  updateItem(key: { [Q in P | S]: T[Q] }, item: Partial<T>): Promise<void>;
  updateExpressionItem(
    key: { [Q in P | S]: T[Q] },
    updateExpression: string,
    additionalExpressionAttributeValues: Record<string, unknown>,
    item: Partial<T>,
    expressionAttributeNames?: Record<string, string>
  ): Promise<void>;
  deleteItem(key: Partial<T>): Promise<void>;
  getAllItems(): Promise<T[]>;
  batchGetItems(keys: Partial<T>[]): Promise<T[]>;
}
