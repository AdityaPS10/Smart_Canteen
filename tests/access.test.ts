import { describe, expect, it } from "vitest";
import { accessFor, isCollegeEmail, landingFor } from "@/lib/access";

describe("role routing", () => {
  it("sends each role to its landing page", () => {
    expect(landingFor("student")).toBe("/canteens");
    expect(landingFor("food_server")).toBe("/staff/counter");
    expect(landingFor("cashier")).toBe("/staff/cashier");
  });

  it("protects pages by role", () => {
    expect(accessFor("/menu/abc")).toEqual(["student"]);
    expect(accessFor("/staff/cashier")).toEqual(["cashier"]);
    expect(accessFor("/staff/counter")).toEqual(["food_server"]);
    expect(accessFor("/staff/kitchen")).toEqual(["food_server"]);
    expect(accessFor("/staff/login")).toBe("public");
    expect(accessFor("/tv/board")).toBe("public");
    expect(accessFor("/api/payments/webhook")).toBe("public");
    expect(accessFor("/api/orders")).toBe("any");
    // prefix matching must not leak: /menuX is not /menu
    expect(accessFor("/tvx")).toBe("any");
  });

  it("restricts Google to the college domain", () => {
    expect(isCollegeEmail("a@mycollege.edu", "mycollege.edu")).toBe(true);
    expect(isCollegeEmail("A@MyCollege.edu", "@mycollege.edu")).toBe(true);
    expect(isCollegeEmail("a@gmail.com", "mycollege.edu")).toBe(false);
    expect(isCollegeEmail("a@evilmycollege.edu", "mycollege.edu")).toBe(false);
    expect(isCollegeEmail("a@mycollege.edu", undefined)).toBe(false);
  });
});
