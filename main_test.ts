import { assertEquals } from "https://deno.land/std@0.75.0/testing/asserts.ts";

import { Interface, InterfaceDef, InterfaceProp } from "./main.ts";

Deno.test("Interface.FromSrc()", () => {
  const actual = Interface.FromSrc(`\
interface Foo {
  prop1: string;
  prop2: number;
  prop3;
}
`);

  assertEquals(
    actual.interfaces,
    [
      {
        name: "Foo",
        properties: [
          {
            name: "prop1",
            kind: "string",
          },
          {
            name: "prop2",
            kind: "number",
          },
          {
            name: "prop3",
            kind: undefined,
          },
        ],
      },
    ],
    "Expected interface definitions to match",
  );
});
