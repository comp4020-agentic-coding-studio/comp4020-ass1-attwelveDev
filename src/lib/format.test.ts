import { describe, expect, it } from "vitest";
import { tieNote, tiedCandidateIds, winnerAnnouncement } from "./format";

describe("tiedCandidateIds", () => {
  it("returns nothing when no other candidate shares the count", () => {
    const counts = { a: 500, b: 300, c: 200 };
    expect(tiedCandidateIds(counts, "a")).toEqual([]);
  });

  it("finds a two-way tie, excluding the outcome id itself", () => {
    const counts = { a: 500, b: 500, c: 0 };
    expect(tiedCandidateIds(counts, "a")).toEqual(["b"]);
  });

  it("finds every other candidate in a three-way tie", () => {
    const counts = { a: 100, b: 100, c: 100 };
    expect(tiedCandidateIds(counts, "a").sort()).toEqual(["b", "c"]);
  });
});

describe("tieNote", () => {
  it("is empty when nothing is tied", () => {
    expect(tieNote([], "votes")).toBe("");
  });

  it("names a single tied candidate", () => {
    expect(tieNote(["Fern"], "votes")).toBe(
      " Tied with Fern on votes — ties are broken alphabetically by name.",
    );
  });

  it("joins three or more tied candidates with a trailing 'and'", () => {
    expect(tieNote(["Fern", "Beech", "Cedar"], "fewest votes")).toBe(
      " Tied with Fern, Beech and Cedar on fewest votes — ties are broken alphabetically by name.",
    );
  });
});

describe("winnerAnnouncement", () => {
  it("names the winner and their exact majority count", () => {
    expect(winnerAnnouncement("Aster", 620, 1000)).toBe(
      "Aster wins after the recount, having crossed a majority of the vote (620 of 1000).",
    );
  });
});
