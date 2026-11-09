import { uniqueNames } from "./export";

describe("uniqueNames", () => {
    it("keeps names unique so they can be used as JSON keys", () => {
        expect(uniqueNames(["Road", "Building", "Road", " ", "Road"])).toEqual([
            "Road",
            "Building",
            "Road (2)",
            "Untitled",
            "Road (3)",
        ]);
    });
});
