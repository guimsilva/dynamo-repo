import {
  BillingMode,
  CreateTableCommand,
  CreateTableCommandInput,
  DeleteTableCommand,
  DeleteTableCommandInput,
  DynamoDBClient,
  KeyType,
  ProjectionType
} from "@aws-sdk/client-dynamodb";
import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";

const marshallOptions = {
  removeUndefinedValues: true
};

const unmarshallOptions = {
  // Whether to return numbers as a string instead of converting them to native JavaScript numbers.
  wrapNumbers: false // false, by default.
};

const translateConfig = { marshallOptions, unmarshallOptions };

const getDbClient = (
  endpoint: string,
  accessKeyId: string,
  secretAccessKey: string,
  region: string
) => {
  const dbClient = new DynamoDBClient({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey
    }
  });
  return dbClient;
};

export const getDdbDocClient = () =>
  DynamoDBDocument.from(
    getDbClient("http://localhost:8000", "FAKE", "FAKE", "FAKE"),
    translateConfig
  );

export const createTable = async (ddbDocClient: DynamoDBDocument, tableName: string) => {
  console.log(`Creating User table...`);

  const params: CreateTableCommandInput = {
    TableName: tableName,
    KeySchema: [{ AttributeName: "id", KeyType: KeyType.HASH }],
    AttributeDefinitions: [
      { AttributeName: "id", AttributeType: "S" },
      { AttributeName: "country", AttributeType: "S" },
      { AttributeName: "birthYearMonth", AttributeType: "N" }
    ],
    BillingMode: BillingMode.PAY_PER_REQUEST,
    GlobalSecondaryIndexes: [
      {
        IndexName: "country-birth-index",
        KeySchema: [
          { AttributeName: "country", KeyType: KeyType.HASH },
          { AttributeName: "birthYearMonth", KeyType: KeyType.RANGE }
        ],
        Projection: {
          ProjectionType: ProjectionType.ALL
        }
      }
    ]
  };
  const command = new CreateTableCommand({
    ...params
  });

  try {
    await ddbDocClient.send(command);
    console.log(`Creating ${params.TableName} table... Done`);
  } catch (err: unknown) {
    console.log(`Error creating ${params.TableName} table`, err);
  }
};

export const deleteTable = async (ddbDocClient: DynamoDBDocument, tableName: string) => {
  console.log(`Deleting User table...`);

  const params: DeleteTableCommandInput = {
    TableName: tableName
  };
  const command = new DeleteTableCommand({
    ...params
  });

  try {
    await ddbDocClient.send(command);
    console.log(`Deleting ${params.TableName} table... Done`);
  } catch (err: unknown) {
    console.log(`Error deleting ${params.TableName} table`, err);
  }
};
