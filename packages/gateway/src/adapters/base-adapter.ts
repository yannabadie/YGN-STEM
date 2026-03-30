import type { Router } from "express";
import type { StemPipeline } from "../pipeline.js";

export interface FrameworkAdapter {
  readonly name: string;
  readonly prefix: string; // URL prefix, e.g. "/adapters/autogen"
  createRouter(pipeline: StemPipeline): Router;
}
