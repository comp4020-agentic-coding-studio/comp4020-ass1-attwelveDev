import { scenarioExplore } from "../data/scenario-explore";
import { scenarioSpoiler } from "../data/scenario-spoiler";
import { initApp } from "./app";
import { initBallotDrift } from "./ballot-drift";
import { initIrvApp } from "./irv-app";

const exploreRoot = document.querySelector("#explore-app");
if (exploreRoot) {
  initApp(exploreRoot, scenarioExplore);
  initBallotDrift(exploreRoot, scenarioExplore);
}

const spoilerRoot = document.querySelector("#spoiler-app");
if (spoilerRoot) {
  initApp(spoilerRoot, scenarioSpoiler);
  initBallotDrift(spoilerRoot, scenarioSpoiler);
}

const recountRoot = document.querySelector("#recount-app");
if (recountRoot) initIrvApp(recountRoot, scenarioSpoiler);
