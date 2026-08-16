import { scenarioExplore } from "../data/scenario-explore";
import { scenarioFreeplay } from "../data/scenario-freeplay";
import { scenarioSpoiler } from "../data/scenario-spoiler";
import { initApp } from "./app";
import { initBallotDrift } from "./ballot-drift";
import { initBallotMarks } from "./ballot-marks";
import { initFreeplayApp } from "./freeplay-app";
import { initIrvApp } from "./irv-app";
import { initIrvDrift } from "./irv-drift";
import { initSpoilerStory } from "./spoiler-story";
import { initStrategicStory } from "./strategic-story";

const fptpIntroRoot = document.querySelector("#fptp-ballot-intro");
const exploreRoot = document.querySelector("#explore-app");
if (exploreRoot) {
  initApp(exploreRoot, scenarioExplore);
  initBallotDrift(fptpIntroRoot, exploreRoot, scenarioExplore);
}

const spoilerRoot = document.querySelector("#spoiler-app");
const spoilerProseRoot = document.querySelector("#spoiler-prose");
if (spoilerRoot) {
  initApp(spoilerRoot, scenarioSpoiler);
  // No hero here: the spoiler's point (a whole electorate splitting its
  // vote) isn't something any single ballot illustrates, unlike the intro
  // chapters' "how the ballot works" heroes.
  initBallotDrift(null, spoilerRoot, scenarioSpoiler);
  if (spoilerProseRoot) initSpoilerStory(spoilerProseRoot, spoilerRoot);
}

const strategicAppRoot = document.querySelector("#strategic-app");
const strategicProseRoot = document.querySelector("#strategic-prose");
if (strategicAppRoot && strategicProseRoot) {
  initStrategicStory(strategicProseRoot, strategicAppRoot);
}

const irvIntroRoot = document.querySelector("#irv-ballot-intro");
const recountRoot = document.querySelector("#recount-app");
if (recountRoot) {
  initIrvApp(recountRoot, scenarioSpoiler);
  initBallotDrift(irvIntroRoot, recountRoot, scenarioSpoiler);
  initIrvDrift(recountRoot, scenarioSpoiler);
}

const freeplayRoot = document.querySelector("#freeplay-app");
if (freeplayRoot) initFreeplayApp(freeplayRoot, scenarioFreeplay);

initBallotMarks(document);
