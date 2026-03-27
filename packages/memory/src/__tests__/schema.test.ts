import { describe, it, expect } from "vitest";
import {
  facts,
  episodes,
  summaries,
  callerProfiles,
  skills,
} from "../db/schema.js";

describe("Drizzle schema — table column presence", () => {
  describe("facts table", () => {
    it("has id column", () => {
      expect(facts.id).toBeDefined();
    });
    it("has subject column", () => {
      expect(facts.subject).toBeDefined();
    });
    it("has predicate column", () => {
      expect(facts.predicate).toBeDefined();
    });
    it("has object column", () => {
      expect(facts.object).toBeDefined();
    });
    it("has confidence column", () => {
      expect(facts.confidence).toBeDefined();
    });
    it("has embedding column", () => {
      expect(facts.embedding).toBeDefined();
    });
    it("has sourceId column", () => {
      expect(facts.sourceId).toBeDefined();
    });
    it("has createdAt column", () => {
      expect(facts.createdAt).toBeDefined();
    });
    it("has updatedAt column", () => {
      expect(facts.updatedAt).toBeDefined();
    });
  });

  describe("episodes table", () => {
    it("has id column", () => {
      expect(episodes.id).toBeDefined();
    });
    it("has callerId column", () => {
      expect(episodes.callerId).toBeDefined();
    });
    it("has requestId column", () => {
      expect(episodes.requestId).toBeDefined();
    });
    it("has summary column", () => {
      expect(episodes.summary).toBeDefined();
    });
    it("has importance column", () => {
      expect(episodes.importance).toBeDefined();
    });
    it("has timestamp column", () => {
      expect(episodes.timestamp).toBeDefined();
    });
    it("has embedding column", () => {
      expect(episodes.embedding).toBeDefined();
    });
    it("has tags column", () => {
      expect(episodes.tags).toBeDefined();
    });
  });

  describe("summaries table", () => {
    it("has entityId column", () => {
      expect(summaries.entityId).toBeDefined();
    });
    it("has entityType column", () => {
      expect(summaries.entityType).toBeDefined();
    });
    it("has summary column", () => {
      expect(summaries.summary).toBeDefined();
    });
    it("has cueAnchors column", () => {
      expect(summaries.cueAnchors).toBeDefined();
    });
    it("has version column", () => {
      expect(summaries.version).toBeDefined();
    });
    it("has lastUpdated column", () => {
      expect(summaries.lastUpdated).toBeDefined();
    });
    it("has embedding column", () => {
      expect(summaries.embedding).toBeDefined();
    });
  });

  describe("callerProfiles table", () => {
    it("has callerId column", () => {
      expect(callerProfiles.callerId).toBeDefined();
    });
    it("has dimensions column", () => {
      expect(callerProfiles.dimensions).toBeDefined();
    });
    it("has interactionCount column", () => {
      expect(callerProfiles.interactionCount).toBeDefined();
    });
    it("has createdAt column", () => {
      expect(callerProfiles.createdAt).toBeDefined();
    });
    it("has updatedAt column", () => {
      expect(callerProfiles.updatedAt).toBeDefined();
    });
  });

  describe("skills table", () => {
    it("has id column", () => {
      expect(skills.id).toBeDefined();
    });
    it("has name column", () => {
      expect(skills.name).toBeDefined();
    });
    it("has description column", () => {
      expect(skills.description).toBeDefined();
    });
    it("has maturity column", () => {
      expect(skills.maturity).toBeDefined();
    });
    it("has tags column", () => {
      expect(skills.tags).toBeDefined();
    });
    it("has version column", () => {
      expect(skills.version).toBeDefined();
    });
    it("has successRate column", () => {
      expect(skills.successRate).toBeDefined();
    });
    it("has usageCount column", () => {
      expect(skills.usageCount).toBeDefined();
    });
  });
});
