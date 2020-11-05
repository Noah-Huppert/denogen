import { assertEquals } from "https://deno.land/std@0.75.0/testing/asserts.ts";

import { isNumber } from "./guards.ts";

Deno.test("isNumber()", () => {
  let yesNum: number = 1;
  let noNum: boolean = false;

  assertEquals(
    isNumber(yesNum),
    true,
    "Expected isNumber on number to be true",
  );
  assertEquals(
    isNumber(noNum),
    false,
    "Expected isNumber on boolean to be false",
  );
});
