export interface AnalysisResult {
  shoplifting: boolean;
  confidence: number;
  reasoning: string;
}

export class IncidentNotFoundError extends Error {
  constructor(id: string) {
    super(`Incident "${id}" not found.`);
    this.name = "IncidentNotFoundError";
  }
}
