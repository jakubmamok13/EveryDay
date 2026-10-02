import type { WorkoutDef } from "@everyday/shared";
import recovery from "./workouts/recovery.json";
import endurance from "./workouts/endurance.json";
import tempo from "./workouts/tempo.json";
import sweetSpot from "./workouts/sweet_spot.json";
import threshold from "./workouts/threshold.json";
import vo2max from "./workouts/vo2max.json";
import anaerobic from "./workouts/anaerobic.json";
import test from "./workouts/test.json";
import longRide from "./workouts/long_ride.json";

/** The curated Workout Library (R8-10). Our own content, versioned with the code. */
export const LIBRARY: WorkoutDef[] = [
  ...recovery,
  ...endurance,
  ...tempo,
  ...sweetSpot,
  ...threshold,
  ...vo2max,
  ...anaerobic,
  ...test,
  ...longRide,
] as WorkoutDef[];

export const LIBRARY_VERSION = 1;
