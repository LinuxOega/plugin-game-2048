import { axiosInstance } from "@halo-dev/api-client";

/** Base path of the plugin's public CustomEndpoint (see ScoreEndpoint.java). */
const BASE = "/apis/api.game2048.halo.run/v1alpha1/scores";

export interface ScoreView {
  player: string;
  score: number;
  maxTile: number;
  moves: number;
  won: boolean;
  createdAt: string | null;
}

export interface ScoreSubmit {
  player: string;
  score: number;
  maxTile: number;
  moves: number;
  won: boolean;
}

export async function fetchLeaderboard(size = 10): Promise<ScoreView[]> {
  const { data } = await axiosInstance.get<ScoreView[]>(BASE, { params: { size } });
  return Array.isArray(data) ? data : [];
}

export async function submitScore(payload: ScoreSubmit): Promise<ScoreView> {
  const { data } = await axiosInstance.post<ScoreView>(BASE, payload);
  return data;
}
