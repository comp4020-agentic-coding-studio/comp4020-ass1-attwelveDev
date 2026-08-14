import { scenarioExplore } from "../data/scenario-explore";
import { scenarioFreeplay } from "../data/scenario-freeplay";
import { scenarioSpoiler } from "../data/scenario-spoiler";
import { initApp } from "./app";
import { initBallotDrift } from "./ballot-drift";
import { initFreeplayApp } from "./freeplay-app";
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
if (recountRoot) {
  initIrvApp(recountRoot, scenarioSpoiler);
  initBallotDrift(recountRoot, scenarioSpoiler);
}

const freeplayRoot = document.querySelector("#freeplay-app");
if (freeplayRoot) initFreeplayApp(freeplayRoot, scenarioFreeplay);
