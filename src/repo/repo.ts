import {
  DynamoDBDocument,
  GetCommandInput,
  QueryCommandInput,
  UpdateCommandInput
} from "@aws-sdk/lib-dynamodb";
import { repoErrorHandler } from "./repo.error.handler";
import { ddbReservedWords } from "./ddb.reserved.words";
import { DBItemBase } from "..";

export class Repo<
  T extends DBItemBase,
  P extends string & keyof T,
  S extends (string & keyof T) | undefined = undefined
> {
  constructor(
    private ddbDocClient: DynamoDBDocument,
    private tableName: string,
    partitionKey: P,
    sortingKey?: S,
    private config = {
      logging: true,
      confirmExistenceBeforeUpdate: true
    }
  ) {
    this.ddbDocClient = ddbDocClient;
    this.key = [partitionKey, sortingKey];
    this.dbItemBaseProjectionExpression = ["dateCreated", "dateUpdated"];
    /** In case this function is not set */
    this.upsertItemFn = (item) => item;
  }

  projectionExpressionItems: (keyof T | `#${string & keyof T}`)[];
  projectionExpression: string;
  expressionAttributeNames: Record<string, string>;
  readonly dbItemBaseProjectionExpression: ("dateCreated" | "dateUpdated")[];
  readonly key: string[];

  /**
   * This function is used to validate or modify the item before adding or updating it.
   * This can be useful to set default values used in indexes or to validate required fields, or both.
   * To validate just throw an error if the field is not valid.
   */
  upsertItemFn?: (item: Partial<T>) => Partial<T>;

  /**
   * Make sure you define all the fields of the table type, so they're saved in the database.
   */
  protected setProjectionExpression(projectionExpression: (keyof T)[]) {
    const expressionAttributeNames: Record<string, string> = {};
    projectionExpression.forEach((item) => {
      if (ddbReservedWords.includes(item as string)) {
        expressionAttributeNames[`#${item as string}`] = item as string;
      }
    });
    if (Object.keys(expressionAttributeNames).length) {
      this.setExpressionAttributeNames(expressionAttributeNames);
    }

    const projectionExpressionWithReservedWords: (keyof T | `#${string & keyof T}`)[] =
      projectionExpression.map((item) =>
        expressionAttributeNames[`#${item as string}`]
          ? (`#${item as string}` as `#${string & keyof T}`)
          : item
      );
    this.projectionExpressionItems = [
      ...projectionExpressionWithReservedWords,
      ...this.dbItemBaseProjectionExpression
    ];
    this.projectionExpression = this.projectionExpressionItems.join(", ");
  }

  /**
   * Optional to override the default expressionAttributeNames based on dynamodb reserved words
   * @param expressionAttributeNames
   */
  protected setExpressionAttributeNames(expressionAttributeNames: Record<string, string>) {
    this.expressionAttributeNames = {
      ...expressionAttributeNames
    };
  }

  protected getUpdateExpression(item: Partial<T>) {
    const result = Object.keys(item)
      .filter((itemKey) => !this.key.includes(itemKey) && itemKey !== "dateCreated")
      .reduce((acc, currentKey) => {
        // if (item[currentKey as keyof T] === undefined) return acc;
        const currentkeyFormatted = this.expressionAttributeNames?.[`#${currentKey}`]
          ? `#${currentKey}`
          : currentKey;
        return acc
          ? `${acc}, ${currentkeyFormatted} = :${currentKey}`
          : `${currentkeyFormatted} = :${currentKey}`;
      }, "");
    return `${result}, dateCreated = if_not_exists(dateCreated, :dateCreated)`;
  }

  protected getExpressionAttributeNames(item: Partial<T>) {
    const result = Object.keys(item).reduce(
      (acc, currentKey) => {
        if (this.expressionAttributeNames?.[`#${currentKey}`]) {
          acc[`#${currentKey}`] = currentKey;
        }
        return acc;
      },
      {} as Record<string, string>
    );
    return !Object.keys(result).length ? undefined : result;
  }

  protected getGenericExpressionAttributeValues(attributes: Record<string, unknown> = {}) {
    if (!Object.keys(attributes).length) return {};
    return Object.keys(attributes).reduce((acc, currentKey) => {
      acc[`:${currentKey}`] = attributes[currentKey];
      return acc;
    }, {});
  }

  protected getSearchExpressionAttributeValues(attributes: Partial<T>) {
    return Object.keys(attributes).reduce((acc, currentKey) => {
      acc[`:${currentKey}`] = attributes[currentKey as keyof T];
      return acc;
    }, {});
  }

  protected getUpdateExpressionAttributeValues(item: Partial<T>) {
    const result = Object.keys(item)
      .filter((itemKey) => !this.key.includes(itemKey))
      .reduce((acc, currentKey) => {
        acc[`:${currentKey}`] = item[currentKey as keyof T];
        return acc;
      }, {});

    result[":dateCreated"] = item.dateCreated ?? Date.now();
    return result;
  }

  protected getItemKeyValues(item: T) {
    return JSON.stringify(
      this.key.reduce(
        (acc, currentKey) => {
          acc[currentKey] = item[currentKey as keyof T];
          return acc;
        },
        {} as Record<string, unknown>
      )
    );
  }

  protected convertUndefinedToNull(item: Partial<T>) {
    return Object.keys(item).reduce((acc, currentKey) => {
      acc[currentKey as keyof T] = item[currentKey as keyof T] ?? null;
      return acc;
    }, {} as T);
  }

  async findItem(key: Record<P | S, T[P] | T[S]>) {
    if (!key) return undefined;

    const params: GetCommandInput = {
      TableName: this.tableName,
      Key: key,
      ProjectionExpression: this.projectionExpression,
      ExpressionAttributeNames: this.expressionAttributeNames
    };

    try {
      console.log(`Finding ${this.tableName} by key ${JSON.stringify(key)}... `);
      const data = await this.ddbDocClient.get(params);
      return data.Item as T;
    } catch (err: unknown) {
      repoErrorHandler(err, `Error finding ${this.tableName} by key ${JSON.stringify(key)}`);
    }
  }

  async searchItems(
    keyConditionExpression: string,
    expressionAttributeValues: Partial<T>,
    indexName?: string,
    projectionExpression?: string,
    expressionAttributeNames: Record<string, string> = this.expressionAttributeNames
  ) {
    const params: QueryCommandInput = {
      TableName: this.tableName,
      IndexName: indexName,
      KeyConditionExpression: keyConditionExpression,
      ExpressionAttributeValues: this.getSearchExpressionAttributeValues(expressionAttributeValues),
      ProjectionExpression: projectionExpression ?? this.projectionExpression,
      ExpressionAttributeNames: expressionAttributeNames
    };

    try {
      console.log(
        `Searching ${this.tableName} by expressionAttributeValues ${JSON.stringify(
          expressionAttributeValues
        )}, keyConditionExpression ${keyConditionExpression} or indexName ${indexName}...`
      );
      const data = await this.ddbDocClient.query(params);
      return data.Items as T[];
    } catch (err: unknown) {
      repoErrorHandler(
        err,
        `Error searching ${this.tableName} by expressionAttributeValues ${JSON.stringify(
          expressionAttributeValues
        )} and keyConditionExpression ${keyConditionExpression}`
      );
    }
  }

  /**
   * If the item with same keys already exists, it will be replaced.
   * Must remove `dateCreated` and `dateUpdated` so it can be updated correctly, otherwise it will keep the same values provided.
   */
  async addItem(item: T) {
    if (!item) return;

    console.log(`Adding ${this.tableName} with key ${this.getItemKeyValues(item)}... `);
    const now = Date.now();
    const _item: T = {
      ...(this.upsertItemFn(item) as T),
      dateCreated: item.dateCreated ?? now,
      dateUpdated: item.dateUpdated ?? now
    };
    const params = {
      TableName: this.tableName,
      Item: _item
    };

    try {
      await this.ddbDocClient.put(params);
      console.log(`Adding ${this.tableName}... Done`);
    } catch (err) {
      repoErrorHandler(
        err,
        `Error adding ${this.tableName} with key ${this.getItemKeyValues(item)}`
      );
    }
  }

  /**
   * Must remove `dateUpdated` so it can be updated automatically, otherwise it will use the value provided.
   */
  async updateItem(key: Record<P | S, T[P] | T[S]>, _item: Partial<T>) {
    if (!key || !_item) return;

    console.log(`Updating ${this.tableName} ... `, JSON.stringify(key));
    const item = this.upsertItemFn({ ...this.convertUndefinedToNull(_item) });
    if (this.config.confirmExistenceBeforeUpdate) {
      const existingItem = await this.findItem(key);
      if (!existingItem) {
        throw new Error(
          `Error updating ${this.tableName} with id ${JSON.stringify(key)} - not found`
        );
      }
    }
    item.dateUpdated = item.dateUpdated ?? Date.now();
    const params: UpdateCommandInput = {
      TableName: this.tableName,
      Key: key,
      UpdateExpression: `set ${this.getUpdateExpression(item)}`,
      ExpressionAttributeValues: {
        ...this.getUpdateExpressionAttributeValues(item)
      },
      ExpressionAttributeNames: this.getExpressionAttributeNames(item)
    };

    try {
      await this.ddbDocClient.update(params);
      console.log(`Updating ${this.tableName}... Done`);
    } catch (err) {
      repoErrorHandler(err, `Error updating ${this.tableName} with id ${JSON.stringify(key)}`);
    }
  }

  async updateExpressionItem(
    key: Record<P | S, T[P] | T[S]>,
    updateExpression: string,
    additionalExpressionAttributeValues: Record<string, unknown>,
    _item: Partial<T>,
    expressionAttributeNames: Record<string, string> = this.expressionAttributeNames
  ) {
    if (!updateExpression || !_item || !Object.keys(_item).length) return;
    const item = { ..._item };

    const potentialWords = updateExpression.match(/(?<!:)(\b\w+\b)/g);
    const itemKeys = Object.keys(item);
    if (potentialWords?.length) {
      potentialWords.forEach((key) => {
        if (itemKeys.includes(key)) {
          delete item[key as keyof T];
        }
      });
      potentialWords.forEach((word) => {
        if (ddbReservedWords.includes(word)) {
          updateExpression = updateExpression.replace(
            new RegExp(`(?<!:)(\\b${word}+\\b)`, "g"),
            `#${word}`
          );
        }
      });
    }
    console.log(`Updating with expression ${this.tableName} ... `, JSON.stringify(key));
    item.dateUpdated = item.dateUpdated ?? Date.now();
    const params: UpdateCommandInput = {
      TableName: this.tableName,
      Key: key,
      UpdateExpression: `set ${this.getUpdateExpression({
        ...item,
        ...(this.upsertItemFn(item) as T)
      })}, ${updateExpression}`,
      ExpressionAttributeValues: {
        ...this.getUpdateExpressionAttributeValues(item),
        ...this.getGenericExpressionAttributeValues(additionalExpressionAttributeValues)
      },
      ExpressionAttributeNames: expressionAttributeNames
    };

    try {
      await this.ddbDocClient.update(params);
      console.log(`Updating with expression ${this.tableName}... Done`);
    } catch (err) {
      repoErrorHandler(
        err,
        `Error updating ${this.tableName} with id ${JSON.stringify(key)} and expression ${
          params.UpdateExpression
        }`
      );
    }
  }

  async deleteItem(key: Partial<T>) {
    if (!key) return;

    console.log(`Deleting ${this.tableName} with key ${JSON.stringify(key)}...`);
    const params = {
      TableName: this.tableName,
      Key: key
    };

    try {
      await this.ddbDocClient.delete(params);
      console.log(`Deleting ${this.tableName} with key ${JSON.stringify(key)}... Done`);
    } catch (err) {
      repoErrorHandler(err, `Error deleting ${this.tableName} with key ${JSON.stringify(key)}`);
    }
  }

  async getAllItems() {
    console.log(`Getting all ${this.tableName}...`);
    const params = {
      TableName: this.tableName,
      ProjectionExpression: this.projectionExpression,
      ExpressionAttributeNames: this.expressionAttributeNames
    };

    try {
      const data = await this.ddbDocClient.scan(params);
      console.log(`Getting all ${this.tableName}... Done`);
      return data.Items as T[];
    } catch (err) {
      repoErrorHandler(err, `Error getting all ${this.tableName}`);
    }
  }

  async batchGetItems(keys: Partial<T>[]) {
    if (!keys || !keys.length) return;

    console.log(`Batch getting ${this.tableName}...`);
    const params = {
      RequestItems: {
        [this.tableName]: {
          Keys: keys
        }
      }
    };

    try {
      const data = await this.ddbDocClient.batchGet(params);
      console.log(`Batch getting ${this.tableName}... Done`);
      return data.Responses[this.tableName] as T[];
    } catch (err) {
      repoErrorHandler(err, `Error batch getting ${this.tableName}`);
    }
  }
}
