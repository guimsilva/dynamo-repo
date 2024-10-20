# dynamo-repo

`dynamo-repo` is a TypeScript library designed to create type-safe, consistent and easier-to-use DynamoDB repositories. It simplifies the interaction with DynamoDB by providing a repository pattern with type safety and handling of reserved words, among other features.

## Features

**Type Safety**: Ensures that all your DynamoDB operations are type-safe.

![alt text](assets/add-user.png)

![alt text](assets/find-user-1.png)

![alt text](assets/find-user-2.png)

**Consistency**: By overriding `upsertItemFn()`, your entity will be automatically validated and updated (index keys etc.) for every insertion or update.

**Reserved Words Handling**: Automatically handles DynamoDB reserved words.

**Ease of Use**: Simplifies common DynamoDB operations with a repository pattern.

## Installation

```sh
npm install dynamo-repo
```

### Getting Started

All you need to do is to create a type to represent your table and a repo to handle it.

```
export class UserRepo extends Repo<TableType, "partitionKey", "optionalSortingKey"> {
  constructor(ddbDocClient: DynamoDBDocument) {
    super(ddbDocClient, "tableName", ["att1", "att2", "att3", ...], "partitionKey", "optionalSortingKey");
    ...
```

#### Step 1: Create an Entity Type or Interface

The first step is to create a type or interface representing your table entity. Make sure you extend the `DBItemBase` type.

```
export interface User extends DBItemBase {
  id: string;
  country: string;
  email: string;
  firstName: string;
  surname: string;
  birthYear: number;
  birthMonth: number;
  /**
   * Reserved words in DynamoDB will be automatically handled
   */
  role: string;
  /**
   * Used as DynamoDB index property, it will always be properly set and updated
   */
  birthYearMonth: number;
}
```

#### Step 2: Create a Repository Class

Create a repository class for your entity by extending the `Repo` class. This repository class will define the structure and operations for your DynamoDB table.

Overriding `upsertItemFn()` is optional.

```
export class UserRepo extends Repo<User, "id"> {
  constructor(ddbDocClient: DynamoDBDocument) {
    super(
      ddbDocClient,
      "user",
      [
        "id",
        "firstName",
        "surname",
        "email",
        "birthYear",
        "birthMonth",
        "country",
        "role",
        "birthYearMonth"
      ],
      "id"
    );
  }

  override upsertItemFn = (item: Partial<User>) => {
    if (item.birthYear === undefined || item.birthMonth === undefined) {
      throw new Error(`User with id ${item.id} doesn't have all required fields`);
    }
    item.birthYearMonth = item.birthYear * 100 + item.birthMonth;
    return item;
  };
}
```

#### Step 3: Instantiate or Inject the Repository Class

```
const ddbDocClient = /* initiate your ddbDocClient instance with your credentials */
const userRepo = new UserRepo(ddbDocClient);
```

### Adding an Item

Add an item to the repository.

```
const user = {
  id: "123",
  country: "Australia",
  email: "user1@dynamo.repo.ts",
  firstName: "John",
  surname: "Doe",
  birthYear: 1990,
  birthMonth: 3,
  role: "user"
} as User;

await userRepo.addItem(user);
```

### Finding an Item

Find an item by its key.

```
const user = await userRepo.findItem({ id: "123" });
```

### Updating an Item

Update an item simply passing the item object.

```
await userRepo.updateItem(
  { id: "123" },
  {
    ...user,
    firstName: "Mike",
    role: "admin"
  }
);
```

Update an item using an expression.

```
await userRepo.updateExpressionItem(
  { id: "123" },
  "firstName = :firstName, role = :role",
  {
    firstName: "Mike",
    role: "admin"
  },
  user
);
```

### Searching for Items

Search for items using the keys or a secondary index.

```
const users = await userRepo.searchItems(
  "country = :country AND birthYearMonth = :birthYearMonth",
  {
    country: "Australia",
    birthYearMonth: 199003
  },
  "country-birth-index"
);
```

### Both `findItem()` and `searchItems()` allow defining `projectionExpression` so it can return partial entities

### You can also delete an item, get all items at once or get items in batches with `deleteItem()`, `getAllItems()` and `batchGetItems()`

### Handling Reserved Words

The library automatically handles DynamoDB reserved words, ensuring your operations are safe and compliant; no need to ever concatenate "#", no need to avoid or modify them.

### Example Test Cases

Example test cases demonstrate the usage of the library.

In order to run the test cases locally you will need a local dynamodb instance running. It's simple and everything you need is described here:
https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.DownloadingAndRunning.html

## License

This project is licensed under the ISC License.
