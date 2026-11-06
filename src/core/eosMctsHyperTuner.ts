/**
 * EOS SYSTEM — MONTE CARLO TREE SEARCH (MCTS) HYPER-TUNER (Layer 0)
 * Governed by SPEC-042, FR-125, BDD-120 & ADR-048
 *
 * Implements Upper Confidence Bound applied to Trees (UCT) for autonomous
 * multi-dimensional parameter search and runtime self-optimization.
 *
 * Mathematical Invariants:
 * 1. UCT Selection Formula: UCT(s, a) = Q(s, a) + c * sqrt(ln(N(s)) / N(s, a))
 * 2. Strict exploration-exploitation balance governed by c = sqrt(2).
 * 3. Monotonic convergence: optimal configuration fitness >= baseline fitness.
 * 4. Zero external runtime dependencies — strictly pure Layer 0.
 */

import {
  pureSha256,
  createMulberry32,
  assertPrecondition,
  assertPostcondition,
  deepFreeze
} from "./eosKernelPrimitives.ts";

export interface ParameterSpace {
  readonly ringBufferSize: readonly number[];
  readonly maxConcurrency: readonly number[];
  readonly gcThresholdMb: readonly number[];
  readonly faultRate: readonly number[];
}

export interface SystemConfiguration {
  readonly ringBufferSize: number;
  readonly maxConcurrency: number;
  readonly gcThresholdMb: number;
  readonly faultRate: number;
}

export interface MctsNode {
  readonly id: string;
  readonly config: SystemConfiguration;
  visits: number;
  totalReward: number;
  readonly children: MctsNode[];
}

export interface MctsTuningReport {
  readonly totalIterations: number;
  readonly exploredNodesCount: number;
  readonly baselineConfig: SystemConfiguration;
  readonly baselineFitness: number;
  readonly optimalConfig: SystemConfiguration;
  readonly optimalFitness: number;
  readonly improvementPercent: number;
  readonly convergenceDurationMs: number;
  readonly sha256Receipt: string;
}

export class EosMctsHyperTuner {
  public static readonly DEFAULT_SPACE: ParameterSpace = {
    ringBufferSize: [1024, 2048, 4096, 8192, 16384],
    maxConcurrency: [50, 100, 200, 500, 1000],
    gcThresholdMb: [64, 128, 256, 512],
    faultRate: [0.01, 0.02, 0.05, 0.10]
  };

  private readonly prng: () => number;
  private readonly explorationConstant = Math.SQRT2;

  constructor(seed: number = 42) {
    this.prng = createMulberry32(seed);
  }

  /**
   * Evaluates the objective fitness function of a system configuration:
   * Fitness = (Throughput / Latency) penalized by Memory Footprint and Fault Rate.
   */
  public evaluateFitness(cfg: SystemConfiguration): number {
    // Model throughput scaling with buffer and concurrency
    const throughput = Math.log2(cfg.ringBufferSize) * 1500 + Math.sqrt(cfg.maxConcurrency) * 200;
    // Model latency penalty with large concurrency and buffers
    const latencyUs = 50 + (cfg.maxConcurrency / 50) + (cfg.ringBufferSize / 2048);
    // Penalty factor for memory and fault rates
    const memPenalty = cfg.gcThresholdMb * 0.05;
    const faultPenalty = cfg.faultRate * 500;

    const rawFitness = (throughput / latencyUs) - memPenalty - faultPenalty;
    return Math.max(0.1, Math.round(rawFitness * 100) / 100);
  }

  /**
   * Executes MCTS search with UCT policy over the parameter space.
   */
  public tuneParameters(
    iterations: number = 150,
    space: ParameterSpace = EosMctsHyperTuner.DEFAULT_SPACE
  ): MctsTuningReport {
    assertPrecondition(iterations > 0, "MCTS iterations must be > 0");
    const t0 = performance.now();

    const baselineConfig: SystemConfiguration = {
      ringBufferSize: space.ringBufferSize[0] ?? 1024,
      maxConcurrency: space.maxConcurrency[0] ?? 50,
      gcThresholdMb: space.gcThresholdMb[0] ?? 64,
      faultRate: space.faultRate[0] ?? 0.01
    };
    const baselineFitness = this.evaluateFitness(baselineConfig);

    const root: MctsNode = {
      id: "root",
      config: baselineConfig,
      visits: 0,
      totalReward: 0,
      children: []
    };

    // Pre-populate root children from parameter space
    for (const rb of space.ringBufferSize) {
      for (const mc of space.maxConcurrency.slice(0, 3)) {
        root.children.push({
          id: `node-${rb}-${mc}`,
          config: {
            ringBufferSize: rb,
            maxConcurrency: mc,
            gcThresholdMb: space.gcThresholdMb[1] ?? 128,
            faultRate: space.faultRate[0] ?? 0.01
          },
          visits: 0,
          totalReward: 0,
          children: []
        });
      }
    }

    let exploredNodes = 1 + root.children.length;

    // Execute MCTS rollouts
    for (let iter = 0; iter < iterations; iter++) {
      // 1. Selection using UCT
      let selected = root;
      while (selected.children.length > 0 && selected.visits > 0) {
        selected = this.selectBestUctChild(selected);
      }

      // 2. Expansion (mutate child parameter)
      if (selected.visits > 0 && selected.children.length === 0) {
        const mutatedConfig = this.sampleMutatedConfig(selected.config, space);
        const childNode: MctsNode = {
          id: `child-${iter}`,
          config: mutatedConfig,
          visits: 0,
          totalReward: 0,
          children: []
        };
        selected.children.push(childNode);
        selected = childNode;
        exploredNodes++;
      }

      // 3. Simulation / Evaluation
      const reward = this.evaluateFitness(selected.config);

      // 4. Backpropagation
      selected.visits++;
      selected.totalReward += reward;
      root.visits++;
      root.totalReward += reward;
    }

    // Determine optimal node with highest mean reward Q(s, a) / N(s, a)
    let bestChild = root.children[0] ?? root;
    let bestAvgReward = -Infinity;

    for (const c of root.children) {
      const avg = c.visits > 0 ? c.totalReward / c.visits : this.evaluateFitness(c.config);
      if (avg > bestAvgReward) {
        bestAvgReward = avg;
        bestChild = c;
      }
    }

    const optimalFitness = this.evaluateFitness(bestChild.config);
    const improvementPercent = Math.round(((optimalFitness - baselineFitness) / baselineFitness) * 10000) / 100;
    const elapsed = Math.round((performance.now() - t0) * 100) / 100;

    assertPostcondition(optimalFitness >= baselineFitness, "MCTS must find a configuration >= baseline fitness");

    const receiptRaw = `${iterations}:${exploredNodes}:${baselineFitness}:${optimalFitness}:${improvementPercent}`;
    const sha256Receipt = pureSha256(receiptRaw);

    const report: MctsTuningReport = {
      totalIterations: iterations,
      exploredNodesCount: exploredNodes,
      baselineConfig,
      baselineFitness,
      optimalConfig: bestChild.config,
      optimalFitness,
      improvementPercent,
      convergenceDurationMs: elapsed,
      sha256Receipt
    };

    return deepFreeze(report);
  }

  private selectBestUctChild(parent: MctsNode): MctsNode {
    let bestChild = parent.children[0]!;
    let bestUct = -Infinity;

    for (const child of parent.children) {
      if (child.visits === 0) {
        return child; // Prioritize unvisited nodes (infinite exploration bonus)
      }
      const meanReward = child.totalReward / child.visits;
      const exploration = this.explorationConstant * Math.sqrt(Math.log(parent.visits) / child.visits);
      const uct = meanReward + exploration;

      if (uct > bestUct) {
        bestUct = uct;
        bestChild = child;
      }
    }
    return bestChild;
  }

  private sampleMutatedConfig(base: SystemConfiguration, space: ParameterSpace): SystemConfiguration {
    const randomChoice = <T>(arr: readonly T[]): T => arr[Math.floor(this.prng() * arr.length)]!;
    return {
      ringBufferSize: this.prng() > 0.5 ? randomChoice(space.ringBufferSize) : base.ringBufferSize,
      maxConcurrency: this.prng() > 0.5 ? randomChoice(space.maxConcurrency) : base.maxConcurrency,
      gcThresholdMb: this.prng() > 0.5 ? randomChoice(space.gcThresholdMb) : base.gcThresholdMb,
      faultRate: this.prng() > 0.5 ? randomChoice(space.faultRate) : base.faultRate
    };
  }
}
