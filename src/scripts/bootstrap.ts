import { scenarioExplore } from "../data/scenario-explore";
import { scenarioSpoiler } from "../data/scenario-spoiler";
import { initApp } from "./app";

const exploreRoot = document.querySelector("#explore-app");
if (exploreRoot) initApp(exploreRoot, scenarioExplore);

const spoilerRoot = document.querySelector("#spoiler-app");
if (spoilerRoot) initApp(spoilerRoot, scenarioSpoiler);
