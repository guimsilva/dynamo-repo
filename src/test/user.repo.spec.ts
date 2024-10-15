import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { createTable, deleteTable, getDdbDocClient } from "./db.setup";
import { User, UserRepo } from "./user.repo.setup";
import { wait } from "./utils";

const longTimeOut = 1000 * 60; // 1 minute timeout

describe("User repo", () => {
  let ddbDocClient: DynamoDBDocument;
  let userRepo: UserRepo;

  const tableName = "user";
  const user = {
    id: "1",
    country: "Australia",
    email: "user1@dynamots.ts",
    firstName: "John",
    surname: "Doe",
    birthYear: 1990,
    birthMonth: 3,
    role: "user"
  } as User;

  beforeAll(async () => {
    ddbDocClient = getDdbDocClient();
    userRepo = new UserRepo(ddbDocClient);
    await createTable(ddbDocClient, tableName);
  });

  afterEach(async () => {
    await deleteTable(ddbDocClient, tableName);
    await wait(0.1);
    await createTable(ddbDocClient, tableName);
    await wait(0.1);
  }, longTimeOut);

  afterAll(async () => {
    await deleteTable(ddbDocClient, tableName);
  }, longTimeOut);

  it(
    "should add an user via `addItem()`",
    async () => {
      await userRepo.addItem(user);
      await wait(0.1);
      const userResult1 = await userRepo.findItem({ id: user.id });
      expect(userResult1.id).toEqual("1");
      expect(userResult1.firstName).toEqual("John");
      expect(userResult1.role).toEqual("user");
      expect(userResult1.birthYearMonth).toEqual(199003);
    },
    longTimeOut
  );

  it(
    "should update an user via `updateItem()`",
    async () => {
      await userRepo.addItem(user);
      await wait(0.1);
      const userResult1 = await userRepo.findItem({ id: user.id });
      expect(userResult1.id).toEqual("1");
      expect(userResult1.firstName).toEqual("John");
      expect(userResult1.role).toEqual("user");
      expect(userResult1.birthYearMonth).toEqual(199003);

      await userRepo.updateItem(
        { id: user.id },
        {
          ...user,
          firstName: "Mike",
          role: "admin"
        }
      );
      await wait(0.1);
      const userResult2 = await userRepo.findItem({ id: user.id });
      expect(userResult2.firstName).toEqual("Mike");
      expect(userResult2.role).toEqual("admin");
      expect(userResult2.birthYearMonth).toEqual(199003);
    },
    longTimeOut
  );

  it(
    "should update an user via `updateExpressionItem()`",
    async () => {
      await userRepo.addItem(user);
      await wait(0.1);
      const userResult1 = await userRepo.findItem({ id: user.id });
      expect(userResult1.id).toEqual("1");
      expect(userResult1.firstName).toEqual("John");
      expect(userResult1.role).toEqual("user");
      expect(userResult1.birthYearMonth).toEqual(199003);

      await userRepo.updateExpressionItem(
        { id: user.id },
        "firstName = :firstName, role = :role",
        {
          firstName: "Mike",
          role: "admin"
        },
        user
      );
      await wait(0.1);
      const userResult2 = await userRepo.findItem({ id: user.id });
      expect(userResult2.firstName).toEqual("Mike");
      expect(userResult2.role).toEqual("admin");
      expect(userResult2.birthYearMonth).toEqual(199003);
    },
    longTimeOut
  );

  it("should search for an user via `searchItem()`", async () => {
    await userRepo.addItem(user);
    await wait(0.1);
    const users = await userRepo.searchItems(
      "country = :country AND birthYearMonth = :birthYearMonth",
      {
        country: "Australia",
        birthYearMonth: 199003
      },
      "country-birth-index"
    );
    expect(users.length).toEqual(1);
    expect(users[0].id).toEqual("1");
    expect(users[0].firstName).toEqual("John");
    expect(users[0].role).toEqual("user");
    expect(users[0].birthYearMonth).toEqual(199003);
  });

  it(
    "should throw an error when adding an user without required fields via `addItem()`",
    async () => {
      const userWithoutRequiredFields = {
        ...user,
        birthMonth: undefined
      } as User;

      try {
        await userRepo.addItem(userWithoutRequiredFields);
        throw new Error("Should not reach this point");
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toEqual(`User with id 1 doesn't have all required fields`);
      }
    },
    longTimeOut
  );
});
