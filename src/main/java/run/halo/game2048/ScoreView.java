package run.halo.game2048;

/** Public projection of a leaderboard row — never exposes raw extension metadata. */
public record ScoreView(
    String player,
    int score,
    int maxTile,
    int moves,
    boolean won,
    String createdAt
) {
}
