import { DynamoDBDocument } from "@aws-sdk/lib-dynamodb";
import { DBItemBase, Repo } from "..";

export interface User extends DBItemBase {
  id: string;
  country: string;
  email: string;
  firstName: string;
  surname: string;
  birthYear: number;
  birthMonth: number;
  /**
   * Reserved word in DynamoDB
   */
  role: string;
  /**
   * Used as DynamoDB index property
   */
  birthYearMonth: number;
}

export class UserRepo extends Repo<User, "id"> {
  constructor(ddbDocClient: DynamoDBDocument) {
    super(ddbDocClient, "user", "id");
    this.setProjectionExpression([
      "id",
      "firstName",
      "surname",
      "email",
      "birthYear",
      "birthMonth",
      "country",
      "role",
      "birthYearMonth"
    ]);
    this.setUpsertItemFn((item) => {
      if (item.birthYear === undefined || item.birthMonth === undefined) {
        throw new Error(`User with id ${item.id} doesn't have all required fields`);
      }
      item.birthYearMonth = item.birthYear * 100 + item.birthMonth;
      return item;
    });
  }
}
