import { NodeRuntime } from '@effect/platform-node';
import { runComponent } from '@sprout/runtime';
NodeRuntime.runMain(runComponent('api'));
